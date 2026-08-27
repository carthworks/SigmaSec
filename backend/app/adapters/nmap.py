# app/adapters/nmap.py
"""
Nmap port/service scanner adapter.

Runs:   nmap -sV -sC --open -oX - <target>
Output: XML parsed via xml.etree.ElementTree
Emits:  one Finding per open port/service

Severity tiers
--------------
HIGH:   22 (SSH), 23 (Telnet), 3389 (RDP), 5900 (VNC), 4444 (shell)
MEDIUM: 21 (FTP), 25/110/143 (mail), 445/139 (SMB), 3306/5432/6379/27017 (DBs)
INFO:   80/443/8080/8443 (HTTP -- Nuclei already covers these)
LOW:    all other open ports
"""

import uuid
import logging
import xml.etree.ElementTree as ET
from typing import List

from app.adapters.base import BaseAdapter
from app.adapters import config
from app.adapters.runner import run_logged_command

logger = logging.getLogger(__name__)

# Port severity mapping
_HIGH_PORTS = {22, 23, 3389, 5900, 4444}
_MEDIUM_PORTS = {21, 25, 110, 143, 445, 139, 3306, 5432, 6379, 27017, 1433, 1521}
_INFO_PORTS = {80, 443, 8080, 8443}


def _port_severity(port: int) -> str:
    if port in _HIGH_PORTS:
        return "high"
    if port in _MEDIUM_PORTS:
        return "medium"
    if port in _INFO_PORTS:
        return "info"
    return "low"


class NmapAdapter(BaseAdapter):
    """
    Runs Nmap in service-version detection mode against a host/IP target.
    Does NOT attempt OS detection (-O) so no elevated capabilities are needed.
    """

    tool_name = "nmap"

    def __init__(self, binary_path: str = None):
        self.binary = self.resolve_binary(
            binary_path or config.NMAP_BINARY, "/usr/bin/nmap"
        )

    def run(
        self,
        target: str,
        scan_id: str,
        org_id: str,
        asset_id: str,
        options: dict = None,
    ) -> List[dict]:
        options = options or {}

        # Strip URL scheme -- nmap wants a bare host/IP
        bare_target = target
        for scheme in ("https://", "http://"):
            if bare_target.startswith(scheme):
                bare_target = bare_target[len(scheme):]
        bare_target = bare_target.split("/")[0].split(":")[0]

        cmd = [
            self.binary,
            "-sV",           # service/version detection
            "-sC",           # default safe scripts
            "--open",        # only report open ports
            "-oX", "-",      # XML output to stdout
            "--host-timeout", str(options.get("host_timeout", "240s")),
            "--max-retries", str(options.get("max_retries", 1)),
        ]

        # Optional port range (default: top 1000)
        if options.get("ports"):
            cmd += ["-p", str(options["ports"])]

        cmd.append(bare_target)

        result = run_logged_command(
            scan_id=scan_id,
            cmd=cmd,
            timeout=config.NMAP_TIMEOUT,
        )

        if result.timed_out:
            logger.warning("[nmap] timed out target=%s", target)

        if result.returncode not in (0, None) and not result.stdout.strip():
            logger.error("[nmap] scan failed rc=%s target=%s", result.returncode, target)
            return []

        findings = self._parse_xml(result.stdout, target, scan_id, org_id, asset_id)
        logger.info("[nmap] %d findings target=%s", len(findings), target)
        return findings

    def _parse_xml(
        self,
        xml_text: str,
        target: str,
        scan_id: str,
        org_id: str,
        asset_id: str,
    ) -> List[dict]:
        if not xml_text.strip():
            return []

        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as exc:
            logger.warning("[nmap] XML parse error: %s", exc)
            return []

        findings: List[dict] = []
        seen: set = set()

        for host_el in root.findall("host"):
            # Resolve host address
            addr_el = host_el.find("address[@addrtype='ipv4']")
            if addr_el is None:
                addr_el = host_el.find("address")
            host_addr = addr_el.attrib.get("addr", target) if addr_el is not None else target

            # Hostname (best-effort)
            hostname_el = host_el.find(".//hostname[@type='PTR']")
            hostname = hostname_el.attrib.get("name", host_addr) if hostname_el is not None else host_addr

            ports_el = host_el.find("ports")
            if ports_el is None:
                continue

            for port_el in ports_el.findall("port"):
                state_el = port_el.find("state")
                if state_el is None or state_el.attrib.get("state") != "open":
                    continue

                portid = int(port_el.attrib.get("portid", 0))
                proto = port_el.attrib.get("protocol", "tcp")

                service_el = port_el.find("service")
                svc_name = (service_el.attrib.get("name", "unknown") if service_el is not None else "unknown")
                svc_product = (service_el.attrib.get("product", "") if service_el is not None else "")
                svc_version = (service_el.attrib.get("version", "") if service_el is not None else "")
                svc_label = " ".join(filter(None, [svc_product, svc_version])) or svc_name

                # Collect NSE script output for description
                script_outputs = []
                for script_el in port_el.findall("script"):
                    sid = script_el.attrib.get("id", "")
                    sout = script_el.attrib.get("output", "")
                    if sout:
                        script_outputs.append(f"{sid}: {sout[:200]}")

                severity = _port_severity(portid)
                title = f"Open {proto.upper()} port {portid}/{svc_name} on {hostname}"

                description_parts = [f"Port {portid}/{proto} is open on {hostname} ({host_addr})."]
                if svc_label and svc_label != svc_name:
                    description_parts.append(f"Service: {svc_name} ({svc_label}).")
                else:
                    description_parts.append(f"Service: {svc_name}.")
                if script_outputs:
                    description_parts.append("Script results: " + " | ".join(script_outputs[:3]))

                fp = self.make_fingerprint(
                    self.tool_name, asset_id, host_addr, f"{portid}/{proto}"
                )
                if fp in seen:
                    continue
                seen.add(fp)

                findings.append({
                    "id": str(uuid.uuid4()),
                    "org_id": org_id,
                    "scan_id": scan_id,
                    "asset_id": asset_id,
                    "fingerprint": fp,
                    "title": title,
                    "severity": severity,
                    "cve_id": None,
                    "tool": self.tool_name,
                    "url": f"{proto}://{host_addr}:{portid}",
                    "description": " ".join(description_parts),
                    "exploit_validated": False,
                    "metadata": {
                        "host": host_addr,
                        "hostname": hostname,
                        "port": portid,
                        "proto": proto,
                        "service": svc_name,
                        "service_label": svc_label,
                        "scripts": script_outputs,
                    },
                })

        return findings
