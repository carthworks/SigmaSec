# app/security/ownership.py
"""
Proof that an organisation controls a domain or IP before SigmaSec sends
active scan traffic to it.

Methods
-------
dns_txt   TXT record at  _sigmasec-challenge.<domain>  with value
          "sigmasec-verification=<token>". Covers the domain and all subdomains.
          Domains only.

http_file File at  http(s)://<host>/.well-known/sigmasec-verification.txt
          whose body contains the token. Covers exactly that host or IP.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Optional

import httpx

from app.security.targets import TargetNotAllowed, assert_public_target, is_ip

DNS_RECORD_PREFIX = "_sigmasec-challenge"
TXT_VALUE_PREFIX = "sigmasec-verification="
HTTP_PATH = "/.well-known/sigmasec-verification.txt"
VERIFICATION_TTL_DAYS = 90
METHODS = ("dns_txt", "http_file")


def new_token() -> str:
    return secrets.token_urlsafe(24)


def dns_record_name(scope: str) -> str:
    return f"{DNS_RECORD_PREFIX}.{scope}"


def txt_value(token: str) -> str:
    return f"{TXT_VALUE_PREFIX}{token}"


def http_urls(scope: str) -> list:
    host = f"[{scope}]" if ":" in scope else scope  # IPv6 literal
    return [f"https://{host}{HTTP_PATH}", f"http://{host}{HTTP_PATH}"]


def instructions(scope: str, method: str, token: str) -> dict:
    if method == "dns_txt":
        return {
            "method": "dns_txt",
            "record_type": "TXT",
            "record_name": dns_record_name(scope),
            "record_value": txt_value(token),
            "covers": f"{scope} and all its subdomains",
        }
    return {
        "method": "http_file",
        "url": http_urls(scope)[0],
        "alternate_url": http_urls(scope)[1],
        "file_contents": token,
        "covers": f"{scope} only",
    }


@dataclass
class CheckResult:
    ok: bool
    detail: str


def validate_method_for_scope(scope: str, method: str) -> None:
    if method not in METHODS:
        raise TargetNotAllowed(f"Unknown verification method '{method}'. Use one of: {', '.join(METHODS)}.")
    if method == "dns_txt" and is_ip(scope):
        raise TargetNotAllowed("IP addresses can't be verified by DNS. Use the HTTP file method.")


def check_dns_txt(scope: str, token: str, resolver=None) -> CheckResult:
    import dns.exception
    import dns.resolver

    name = dns_record_name(scope)
    expected = txt_value(token)
    r = resolver or dns.resolver.Resolver()
    r.lifetime = 5.0
    try:
        answers = r.resolve(name, "TXT")
    except dns.resolver.NXDOMAIN:
        return CheckResult(False, f"No TXT record found at {name}.")
    except dns.resolver.NoAnswer:
        return CheckResult(False, f"{name} exists but has no TXT record.")
    except dns.exception.DNSException as exc:
        return CheckResult(False, f"DNS lookup for {name} failed ({type(exc).__name__}). Try again shortly.")

    values = []
    for rdata in answers:
        values.append(b"".join(rdata.strings).decode("utf-8", "replace"))
    if expected in values:
        return CheckResult(True, f"Found the TXT record at {name}.")
    return CheckResult(False, f"TXT record at {name} doesn't contain the expected value. DNS changes can take a few minutes to appear.")


def check_http_file(scope: str, token: str, client: Optional[httpx.Client] = None) -> CheckResult:
    # Never fetch from internal addresses, even for verification.
    try:
        assert_public_target(scope)
    except TargetNotAllowed as exc:
        return CheckResult(False, str(exc))

    own_client = client is None
    c = client or httpx.Client(timeout=5.0, follow_redirects=False, verify=True,
                               headers={"User-Agent": "SigmaSec-Verifier/1.0"})
    last_problem = "the file could not be fetched"
    try:
        for url in http_urls(scope):
            try:
                with c.stream("GET", url) as resp:
                    if resp.status_code != 200:
                        last_problem = f"{url} returned HTTP {resp.status_code}"
                        continue
                    body = b""
                    for chunk in resp.iter_bytes():
                        body += chunk
                        if len(body) > 4096:
                            break
                    if token in body.decode("utf-8", "replace"):
                        return CheckResult(True, f"Found the verification file at {url}.")
                    last_problem = f"{url} doesn't contain the verification token"
            except httpx.HTTPError as exc:
                last_problem = f"{url} could not be fetched ({type(exc).__name__})"
    finally:
        if own_client:
            c.close()
    return CheckResult(False, f"Verification failed: {last_problem}. Redirects are not followed.")


def run_check(scope: str, method: str, token: str) -> CheckResult:
    if method == "dns_txt":
        return check_dns_txt(scope, token)
    return check_http_file(scope, token)
