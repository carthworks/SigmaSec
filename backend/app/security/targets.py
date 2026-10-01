# app/security/targets.py
"""
Target safety for scans that send traffic to a host (Nuclei web scans, Nmap
network scans).

Two independent checks:

1. assert_public_target(): the host must resolve only to public, routable
   addresses. This blocks the scanner from probing its own network
   (Postgres, Redis, cloud metadata) through private IPs, loopback,
   link-local addresses, or hostnames that resolve to them
   (e.g. 127.0.0.1.nip.io, decimal IPs like 2130706433).

2. Ownership (see app.security.ownership): the organisation must have proven
   it controls the domain or IP before an active scan is allowed.
"""

from __future__ import annotations

import ipaddress
import socket
from typing import List, Optional
from urllib.parse import urlsplit


class TargetNotAllowed(ValueError):
    """The target is malformed or resolves to a non-public address."""


def extract_host(target: str) -> str:
    """
    Return the lower-cased hostname or IP from a URL or bare host[:port][/path].
    Strips scheme, userinfo, port and path; unwraps bracketed IPv6.
    """
    raw = (target or "").strip()
    if not raw:
        raise TargetNotAllowed("Target is empty.")
    if "://" not in raw:
        raw = "scan://" + raw
    try:
        parts = urlsplit(raw)
        host = parts.hostname  # lower-cased, brackets and port removed
    except ValueError as exc:
        raise TargetNotAllowed(f"Target '{target}' is not a valid host or URL.") from exc
    if not host:
        raise TargetNotAllowed(f"Target '{target}' has no host.")
    host = host.rstrip(".")
    if any(c.isspace() for c in host) or "/" in host:
        raise TargetNotAllowed(f"Target '{target}' is not a valid host or URL.")
    return host


def is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def _is_public(addr: str) -> bool:
    ip = ipaddress.ip_address(addr.split("%", 1)[0])  # drop IPv6 zone id
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not (ip.is_multicast or ip.is_reserved or ip.is_unspecified)


def resolve_host(host: str) -> List[str]:
    """All addresses the host resolves to (IPv4 and IPv6), de-duplicated."""
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError) as exc:
        raise TargetNotAllowed(f"'{host}' does not resolve.") from exc
    addrs = []
    for info in infos:
        addr = info[4][0]
        if addr not in addrs:
            addrs.append(addr)
    if not addrs:
        raise TargetNotAllowed(f"'{host}' does not resolve.")
    return addrs


def assert_public_target(target: str) -> List[str]:
    """
    Raise TargetNotAllowed unless every address the target resolves to is public.
    Returns the resolved addresses.
    """
    host = extract_host(target)
    if host == "localhost" or host.endswith(".localhost") or host.endswith(".local") or host.endswith(".internal"):
        raise TargetNotAllowed(f"'{host}' is an internal hostname and can't be scanned.")
    addrs = resolve_host(host)
    blocked = [a for a in addrs if not _is_public(a)]
    if blocked:
        raise TargetNotAllowed(
            f"'{host}' resolves to a private, loopback or reserved address ({', '.join(blocked)}), "
            "which can't be scanned."
        )
    return addrs


def candidate_domains(host: str) -> List[str]:
    """
    Domains whose DNS verification would cover this host: the host itself and
    each parent with at least two labels (api.eu.acme.com -> api.eu.acme.com,
    eu.acme.com, acme.com).
    """
    if is_ip(host):
        return []
    labels = host.split(".")
    return [".".join(labels[i:]) for i in range(len(labels) - 1)]


def normalise_scope(value: str) -> str:
    """Normalise a domain or IP the user wants to verify."""
    host = extract_host(value)
    if is_ip(host):
        return str(ipaddress.ip_address(host))
    if "." not in host:
        raise TargetNotAllowed("Enter a fully qualified domain (e.g. example.com) or a public IP address.")
    return host


def covering_scope(host: str, scopes: List[tuple]) -> Optional[tuple]:
    """
    Given verified (scope, method) pairs, return the one that covers host, if any.
      - dns_txt on a domain covers that domain and all its subdomains.
      - http_file covers exactly the host (domain or IP) it was served from.
    """
    host_norm = str(ipaddress.ip_address(host)) if is_ip(host) else host
    domains = set(candidate_domains(host_norm))
    for scope, method in scopes:
        if method == "http_file" and scope == host_norm:
            return (scope, method)
        if method == "dns_txt" and scope in domains:
            return (scope, method)
    return None
