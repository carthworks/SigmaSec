# app/adapters/runner.py

import time
import select
import logging
import subprocess
from dataclasses import dataclass
from typing import List, Optional

import redis

from app.adapters import config

import re

_SENSITIVE_PATTERNS = [
    (re.compile(r"(?i)(api[_-]?key|secret|password|token|bearer|auth|private[_-]?key)\s*[:=]\s*['\"]?[\w\-/+=]{8,}['\"]?"), r"\1=[REDACTED]"),
    (re.compile(r"Bearer\s+[\w\.\-/+=]+", re.IGNORECASE), "Bearer [REDACTED]"),
    (re.compile(r"-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----"), "[REDACTED PRIVATE KEY]"),
]


def _redact_sensitive(text: str) -> str:
    if not text:
        return ""
    redacted = text
    for pattern, repl in _SENSITIVE_PATTERNS:
        redacted = pattern.sub(repl, redacted)
    return redacted


# Module-level pool: one pool per worker process, cheap Redis() handles per call.
_pool: Optional[redis.ConnectionPool] = None


def _redis() -> redis.Redis:
    global _pool
    if _pool is None:
        _pool = redis.ConnectionPool.from_url(
            config.REDIS_URL,
            decode_responses=True,
            max_connections=16,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return redis.Redis(connection_pool=_pool)


@dataclass
class CommandResult:
    """
    Result of a logged command run.

    BREAKING CHANGE vs the old runner: this used to return a bare stdout `str`.
    Callers now read `.stdout`. This lets adapters distinguish a *failed* scan
    (non-zero rc / timeout with no output) from a *clean* scan (rc 0, empty).
    """
    stdout: str
    returncode: Optional[int]
    timed_out: bool

    @property
    def ok(self) -> bool:
        return not self.timed_out and self.returncode == 0


class _LogSink:
    """
    Batches scan log lines and flushes to Redis via pipeline.
    A Redis outage degrades logging but MUST NOT abort a scan.
    Caps total entries and sets a TTL so scan logs can't grow unbounded.
    """

    def __init__(self, scan_id: str, flush_every: int = 25):
        self.key = f"scan:{scan_id}:logs"
        self.flush_every = flush_every
        self.buf: List[str] = []
        self.count = 0
        try:
            self.r: Optional[redis.Redis] = _redis()
        except Exception as e:
            logger.warning("scan log Redis unavailable (%s); logging disabled", e)
            self.r = None

    def push(self, line: str) -> None:
        if self.r is None or self.count >= config.LOG_MAX_ENTRIES:
            return
        self.buf.append(line)
        self.count += 1
        if len(self.buf) >= self.flush_every:
            self.flush()

    def flush(self) -> None:
        if self.r is None or not self.buf:
            return
        batch, self.buf = self.buf, []
        try:
            pipe = self.r.pipeline()
            pipe.rpush(self.key, *batch)
            pipe.expire(self.key, config.LOG_TTL_SECONDS)
            pipe.execute()
        except Exception as e:
            logger.warning("scan log flush failed (%s); disabling further logging", e)
            self.r = None  # stop trying; don't spam the log on every line


def _terminate(process: subprocess.Popen) -> None:
    """Kill a runaway process and reap it so it can't orphan."""
    for step in (process.kill,):
        try:
            step()
        except Exception:
            pass
    try:
        process.wait(timeout=5)
    except Exception:
        pass


def run_logged_command(
    scan_id: str,
    cmd: list,
    timeout: int = 600,
    capture_stdout: bool = True,
    cwd: str = None,
    env: dict = None,
) -> CommandResult:
    """
    Run `cmd`, stream stderr (and non-JSON stdout) lines to Redis, and enforce a
    hard wall-clock `timeout`. Kills and reaps the process on timeout.
    Returns CommandResult(stdout, returncode, timed_out).
    """
    sink = _LogSink(scan_id)
    sink.push(f"[system] launching: {' '.join(cmd)}")

    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=cwd,
            env=env,  # None => inherit parent env
        )
    except FileNotFoundError as e:
        sink.push(f"[system] executable not found: {e}")
        sink.flush()
        return CommandResult(stdout="", returncode=127, timed_out=False)

    stdout_lines: List[str] = []
    active = [process.stdout, process.stderr]
    deadline = time.monotonic() + timeout
    timed_out = False

    # Read loop with an actual deadline. Pipes are removed on EOF; the loop ends
    # when both are drained OR the deadline passes.
    while active:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            timed_out = True
            break

        readable, _, _ = select.select(active, [], [], min(0.5, remaining))
        for pipe in readable:
            line = pipe.readline()
            if line == "":  # EOF on this pipe
                active.remove(pipe)
                continue
            cleaned = _redact_sensitive(line.strip())
            if pipe is process.stdout:
                if capture_stdout:
                    stdout_lines.append(line)
                # Keep large JSON dumps out of the human log feed.
                if cleaned and len(cleaned) < 500 and cleaned[:1] not in "{[":
                    sink.push(f"[stdout] {cleaned}")
            else:
                if cleaned:
                    sink.push(f"[stderr] {cleaned}")


    if timed_out:
        sink.push(f"[system] timeout after {timeout}s — killing scanner")
        _terminate(process)
        rc = process.returncode
    else:
        try:
            rc = process.wait(timeout=max(1.0, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            timed_out = True
            sink.push("[system] wait timeout — killing scanner")
            _terminate(process)
            rc = process.returncode

    sink.push(f"[system] completed. status={rc} timed_out={timed_out}")
    sink.flush()
    return CommandResult(stdout="".join(stdout_lines), returncode=rc, timed_out=timed_out)
