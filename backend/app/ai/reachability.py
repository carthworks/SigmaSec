# app/ai/reachability.py

import os
import ast
import re
import logging
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from app.ai.claude_client import AIClient

logger = logging.getLogger(__name__)

class ReachabilityClassification(BaseModel):
    reachability: str = Field(description="Reachability classification (reachable, unreachable, uncertain)")
    confidence: float = Field(description="Confidence score from 0.0 to 1.0")
    reasoning: str = Field(description="Reasoning explaining the classification decision")


def analyze_python_file(file_path: str, package_name: str) -> Optional[dict]:
    """
    Parses a python file with AST to extract package imports and call sites.
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        tree = ast.parse(content, filename=file_path)
    except Exception:
        return None

    imported_names = set()
    import_lines = []

    # Find imports of the package
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for name in node.names:
                if name.name == package_name or name.name.startswith(package_name + "."):
                    alias = name.asname or name.name
                    imported_names.add(alias)
                    import_lines.append(f"import {name.name}")
        elif isinstance(node, ast.ImportFrom):
            if node.module == package_name or (node.module and node.module.startswith(package_name + ".")):
                for name in node.names:
                    alias = name.asname or name.name
                    imported_names.add(alias)
                import_lines.append(f"from {node.module} import ...")

    if not imported_names:
        return None

    # Find call sites
    call_sites = []
    lines = content.splitlines()

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = None
            if isinstance(node.func, ast.Name):
                if node.func.id in imported_names:
                    func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                if isinstance(node.func.value, ast.Name) and node.func.value.id in imported_names:
                    func_name = f"{node.func.value.id}.{node.func.attr}"

            if func_name:
                line_no = getattr(node, "lineno", 1)
                start = max(0, line_no - 3)
                end = min(len(lines), line_no + 2)
                snippet = "\n".join(lines[start:end])
                call_sites.append({
                    "line": line_no,
                    "code": snippet,
                    "func": func_name
                })

    return {
        "imports": import_lines,
        "call_sites": call_sites
    }


def analyze_generic_file(file_path: str, package_name: str) -> Optional[dict]:
    """
    A line-based scanner for non-Python languages to detect package imports and call sites.
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except Exception:
        return None

    import_lines = []
    call_sites = []

    # Detect imports/requires
    for idx, line in enumerate(lines):
        line_num = idx + 1
        if "import" in line or "require" in line:
            # Match package name in quotes or brackets
            if package_name in line:
                import_lines.append(line.strip())

    if not import_lines:
        return None

    # Detect call sites (basic heuristic: package name or import variable with opening parenthesis)
    for idx, line in enumerate(lines):
        line_num = idx + 1
        if package_name in line and "(" in line:
            if any(imp in line for imp in ["import", "require"]):
                continue
            start = max(0, idx - 2)
            end = min(len(lines), idx + 3)
            snippet = "".join(lines[start:end])
            call_sites.append({
                "line": line_num,
                "code": snippet,
                "func": package_name
            })

    return {
        "imports": import_lines,
        "call_sites": call_sites
    }


def scan_repo_for_package(repo_path: str, package_name: str) -> dict:
    """
    Walks the repository directory to detect imports and call sites for a package.
    """
    import_graph = []
    all_call_sites = []

    for root, dirs, files in os.walk(repo_path):
        # Prune search paths
        dirs[:] = [d for d in dirs if d not in [".git", "node_modules", "venv", ".venv", "__pycache__", "dist", "build"]]
        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, repo_path)
            
            res = None
            if file.endswith(".py"):
                res = analyze_python_file(file_path, package_name)
            elif file.endswith((".js", ".ts", ".jsx", ".tsx", ".go", ".java", ".rb", ".php")):
                res = analyze_generic_file(file_path, package_name)
                
            if res:
                for imp in res["imports"]:
                    import_graph.append(f"{rel_path}: {imp}")
                for cs in res["call_sites"]:
                    cs["file"] = rel_path
                    all_call_sites.append(cs)

    return {
        "import_graph": import_graph,
        "call_sites": all_call_sites
    }


def extract_vulnerable_functions_from_desc(description: str) -> List[str]:
    """
    Heuristically parses potential function/method/class names from a CVE description.
    """
    if not description:
        return []
    matches = re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*(?:\(\))?", description)
    candidates = []
    for m in matches:
        if "(" in m:
            candidates.append(m.replace("()", ""))
        elif "_" in m and len(m) > 3:
            candidates.append(m)
        elif any(c.isupper() for c in m) and any(c.islower() for c in m) and len(m) > 3:
            candidates.append(m)
    return list(set(candidates))


def build_reachability_prompt(description: str, vuln_funcs: List[str], import_graph: List[str], call_sites: List[dict]) -> str:
    """
    Constructs the prompt for Claude to classify call-site reachability.
    """
    vuln_funcs_str = ", ".join(vuln_funcs) if vuln_funcs else "Not explicitly identified (analyze description)"
    import_graph_str = "\n".join(import_graph[:20])
    
    call_sites_str = ""
    for idx, cs in enumerate(call_sites[:5]):
        call_sites_str += (
            f"Call Site #{idx+1} in {cs['file']} (Line {cs['line']}):\n"
            f"```\n{cs['code']}\n```\n\n"
        )
        
    prompt = f"""You are an AST analysis agent determining the reachability of a vulnerable package in a codebase.

CVE DESCRIPTION:
{description}

POTENTIAL VULNERABLE FUNCTIONS/CLASSES:
{vuln_funcs_str}

REPOSITORY IMPORT GRAPH (where the package is imported):
{import_graph_str}

CALL SITES (usages of the package in repository code):
{call_sites_str}

Based on the import graph and call sites, classify if the vulnerable functions/methods of the package are reachable in the repository.
Specifically, determine if the codebase actively invokes/executes the vulnerable path ("reachable"), imports the package but does not execute the vulnerable path ("unreachable"), or if it is "uncertain".

You must respond with a single JSON object matching this exact schema:
{{
  "reachability": "reachable / unreachable / uncertain",
  "confidence": 0.0 to 1.0,
  "reasoning": "A detailed explanation justifying the classification."
}}
"""
    return prompt


def extract_json(text: str) -> str:
    cleaned = text.strip()
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
    if match:
        return match.group(1).strip()
    
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1:
        return cleaned[start:end+1].strip()
    return cleaned


def determine_cve_reachability(finding: Any, repo_path: str, client: Optional[AIClient] = None, db: Optional[Any] = None) -> ReachabilityClassification:
    """
    Orchestrates reachability analysis for a finding using codebase matching and AI.
    """
    if client is None:
        client = AIClient()

    package_name = None
    if finding.metadata and isinstance(finding.metadata, dict):
        package_name = finding.metadata.get("package")
    
    if not package_name:
        return ReachabilityClassification(
            reachability="uncertain",
            confidence=0.5,
            reasoning="No package name metadata found for vulnerability."
        )

    # 1. Scan repo
    scan_results = scan_repo_for_package(repo_path, package_name)
    import_graph = scan_results["import_graph"]
    call_sites = scan_results["call_sites"]

    # If package is not imported anywhere, it is unreachable
    if not import_graph:
        return ReachabilityClassification(
            reachability="unreachable",
            confidence=1.0,
            reasoning=f"The package '{package_name}' is not imported anywhere in the repository code."
        )

    # 2. Extract potential vuln methods
    vuln_funcs = extract_vulnerable_functions_from_desc(finding.description or "")

    # 3. Query LLM
    prompt = build_reachability_prompt(finding.description or "", vuln_funcs, import_graph, call_sites)
    system_prompt = "Return ONLY valid JSON, no markdown, no preamble."

    response_text = client._call_model_with_model_override(
        prompt=prompt,
        system_prompt=system_prompt,
        db=db,
        finding_id=finding.id
    )

    try:
        json_str = extract_json(response_text)
        return ReachabilityClassification.model_validate_json(json_str)
    except Exception as e:
        logger.warning(f"First reachability parse failed: {e}. Retrying with stricter prompt...")
        stricter_prompt = (
            "CRITICAL ERROR: Your previous response could not be parsed as valid JSON matching the schema. "
            "You MUST return ONLY a raw JSON object. Do not wrap in markdown code blocks like ```json ... ```. "
            "Do not include any explanation, preamble, or trailing text. Start your response with '{' and end with '}'.\n\n"
            f"Original Request:\n{prompt}"
        )
        retry_response_text = client._call_model_with_model_override(
            prompt=stricter_prompt,
            system_prompt=system_prompt,
            db=db,
            finding_id=finding.id
        )
        try:
            retry_json_str = extract_json(retry_response_text)
            return ReachabilityClassification.model_validate_json(retry_json_str)
        except Exception as retry_err:
            logger.error(f"Second reachability parse failed: {retry_err}")
            return ReachabilityClassification(
                reachability="uncertain",
                confidence=0.5,
                reasoning=f"Failed to parse LLM response for reachability analysis: {retry_err}"
            )
