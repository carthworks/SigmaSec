import os
import httpx
import logging
import time
import re
from typing import Any
from dotenv import load_dotenv

# Load local environment variables
load_dotenv()

logger = logging.getLogger(__name__)

def redact_secrets(text: str) -> str:
    """
    Pre-flight scrubbing of sensitive credentials and secrets before dispatching to AI models.
    """
    if not text:
        return text
    
    # Redact AWS Access Key IDs
    text = re.sub(r"AKIA[0-9A-Z]{16}", "[REDACTED_AWS_KEY]", text)
    # Redact GitHub PATs
    text = re.sub(r"gh[pous]_[0-9a-zA-Z]{36,}", "[REDACTED_GITHUB_TOKEN]", text)
    # Redact Private Keys
    text = re.sub(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----", "[REDACTED_PRIVATE_KEY]", text)
    # Redact JWTs
    text = re.sub(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", "[REDACTED_JWT]", text)
    # Redact basic credential assignments
    text = re.sub(r"(?i)(password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*['\"][^'\"]{6,}['\"]", r'\1="[REDACTED_CREDENTIAL]"', text)
    return text

# Customizable configuration via environment variables
AI_PROVIDER = os.environ.get("AI_PROVIDER", "ollama").lower()  # "ollama" or "anthropic"
AI_MODEL = os.environ.get("AI_MODEL", "llama3:latest" if AI_PROVIDER == "ollama" else "claude-3-5-sonnet-20241022")
OLLAMA_API_BASE = os.environ.get("OLLAMA_API_BASE", "http://host.docker.internal:11434")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

class AIClient:
    """
    Unified AI client wrapper supporting local Ollama models (default) and Anthropic Claude.
    """
    def __init__(self):
        self.provider = AI_PROVIDER
        self.ollama_base = OLLAMA_API_BASE
        self.anthropic_key = ANTHROPIC_API_KEY
        self.local_models = []
        
        if self.provider == "ollama":
            self.model = self._resolve_ollama_model(AI_MODEL)
        else:
            self.model = AI_MODEL

    def _resolve_ollama_model(self, requested_model: str) -> str:
        """
        Queries Ollama API tags endpoint to check available models and resolve the best matches.
        """
        endpoints = [
            f"{self.ollama_base}/api/tags",
            "http://host.docker.internal:11434/api/tags",
            "http://172.17.0.1:11434/api/tags",
            "http://127.0.0.1:11434/api/tags",
        ]
        
        local_models = []
        for url in endpoints:
            try:
                response = httpx.get(url, timeout=3.0)
                if response.status_code == 200:
                    models_list = response.json().get("models", [])
                    local_models = [m.get("name") for m in models_list if m.get("name")]
                    if local_models:
                        # Update ollama_base to the base url of the successful endpoint
                        self.ollama_base = url.replace("/api/tags", "")
                        logger.info(f"Resolved active Ollama base URL to: {self.ollama_base} with models: {local_models}")
                        break
            except Exception:
                continue

        self.local_models = local_models

        if not local_models:
            # If Ollama isn't running or reachable, fallback to requested model tag
            return requested_model

        # Perfect match check
        if requested_model in local_models:
            return requested_model

        # Resolve tag inconsistencies
        if requested_model == "llama3" and "llama3:latest" in local_models:
            return "llama3:latest"
        if requested_model == "llama3:latest" and "llama3" in local_models:
            return "llama3"

        # Search for any valid text model downloaded locally from the list
        preferred_order = [
            "llama3:latest",
            "llama3",
            "llama3.2:latest",
            "llama3.2",
            "llama3.1:latest",
            "llama3.1",
            "mistral:latest",
            "gemma3:4b",
            "deepseek-coder:6.7b",
            "qwen2.5:latest",
            "qwen3:4b",
            "llava:latest",
            "glm-ocr:latest"
        ]
        
        for pref in preferred_order:
            if pref in local_models:
                logger.info(f"Ollama requested model '{requested_model}' not found. Auto-selecting local fallback: '{pref}'")
                return pref

        # Default to first available local model
        logger.info(f"Ollama requested model '{requested_model}' not found. Defaulting to first available local tag: '{local_models[0]}'")
        return local_models[0]

    def analyze_vulnerability(self, cve_id: str, severity: str, title: str, description: str) -> str:
        """
        Generates a plain-English security analysis and actionable remediation steps for a vulnerability.
        """
        prompt = (
            f"You are an expert security engineer auditing vulnerabilities. Explain the following finding in plain English, "
            f"describe the real-world risk it poses to the target, and outline actionable, step-by-step remediation guidance. "
            f"Keep your response concise, developer-focused, and under 150 words. Do not include markdown headers or greetings.\n\n"
            f"Vulnerability Title: {title}\n"
            f"CVE ID: {cve_id if cve_id else 'N/A'}\n"
            f"Severity: {severity}\n"
            f"Description: {description if description else 'No description available.'}\n"
        )

        if self.provider == "anthropic":
            return self._call_anthropic(prompt)
        else:
            return self._call_ollama(prompt)

    def _call_ollama(self, prompt: str, model_override: str = None, system_prompt: str = None, db: Any = None, finding_id: Any = None, scan_id: Any = None, call_type: str = None) -> str:
        """
        Invokes local Ollama service using the API gateway url.
        """
        # Pre-flight secret scrubbing
        prompt = redact_secrets(prompt)
        if system_prompt:
            system_prompt = redact_secrets(system_prompt)

        # If models weren't discovered yet, attempt fresh resolution
        if not self.local_models:
            self.model = self._resolve_ollama_model(self.model)

        model_to_use = model_override or self.model
        payload = {
            "model": model_to_use,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.0,
                "num_predict": 250 if model_override else 180
            }
        }
        if system_prompt:
            payload["system"] = system_prompt

        candidate_bases = [
            self.ollama_base,
            "http://host.docker.internal:11434",
            "http://172.17.0.1:11434",
            "http://127.0.0.1:11434"
        ]
        # Deduplicate while preserving order
        candidate_bases = list(dict.fromkeys(candidate_bases))

        last_error = None
        for base in candidate_bases:
            url = f"{base}/api/generate"
            try:
                logger.info(f"Connecting to Ollama at {url} (Model: {model_to_use})")
                response = httpx.post(url, json=payload, timeout=60.0)
                if response.status_code == 200:
                    data = response.json()
                    response_text = data.get("response", "").strip()
                    self.ollama_base = base  # Cache successful base

                    if db is not None:
                        try:
                            from app.models.ai_call import AICall
                            prompt_len = len(prompt) + len(system_prompt or "")
                            resp_len = len(response_text)
                            prompt_tokens = max(1, prompt_len // 4)
                            completion_tokens = max(1, resp_len // 4)
                            
                            ai_call = AICall(
                                finding_id=finding_id,
                                scan_id=scan_id,
                                call_type=call_type,
                                prompt=prompt,
                                response=response_text,
                                provider="ollama",
                                model=model_to_use,
                                prompt_tokens=prompt_tokens,
                                completion_tokens=completion_tokens,
                                cost=0.0
                            )
                            db.add(ai_call)
                            db.commit()
                        except Exception as log_ex:
                            logger.error(f"Failed to log AI call: {log_ex}")

                    return response_text
                else:
                    last_error = f"Status {response.status_code} - {response.text}"
            except Exception as e:
                last_error = str(e)
                continue

        logger.error(f"Failed to communicate with local Ollama service: {last_error}")
        return f"AI Analysis pending... (Ollama model '{model_to_use}' is offline or timed out.)"

    def _call_anthropic(self, prompt: str, model_override: str = None, system_prompt: str = None, db: Any = None, finding_id: Any = None, scan_id: Any = None, call_type: str = None) -> str:
        """
        Invokes Anthropic Claude messages endpoint with pre-flight secret redaction and 429/529 backoff retry.
        """
        if not self.anthropic_key:
            return "AI Analysis pending... (Anthropic API Key is missing in backend env)"

        # Pre-flight secret scrubbing
        prompt = redact_secrets(prompt)
        if system_prompt:
            system_prompt = redact_secrets(system_prompt)

        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.anthropic_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        model_to_use = model_override or self.model
        payload = {
            "model": model_to_use,
            "max_tokens": 1000,
            "temperature": 0.0,
            "messages": [
                {"role": "user", "content": prompt}
            ]
        }
        if system_prompt:
            payload["system"] = system_prompt

        # Up to 3 attempts with exponential backoff on rate limits / temporary overload
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                logger.info(f"Connecting to Anthropic API (Model: {model_to_use}, Attempt {attempt + 1}/{max_attempts})")
                response = httpx.post(url, json=payload, headers=headers, timeout=30.0)
                
                # Rate limit (429) or Overloaded (529) backoff
                if response.status_code in (429, 529) and attempt < max_attempts - 1:
                    sleep_sec = 2.0 ** attempt
                    logger.warning(f"Anthropic returned status {response.status_code}. Backing off for {sleep_sec:.1f}s...")
                    time.sleep(sleep_sec)
                    continue

                if response.status_code != 200:
                    return f"Claude API returned error: Status {response.status_code} - {response.text}"
                
                data = response.json()
                content = data.get("content", [])
                response_text = "AI Analysis pending..."
                if content and isinstance(content, list):
                    response_text = content[0].get("text", "").strip()

                if db is not None:
                    try:
                        from app.models.ai_call import AICall
                        prompt_len = len(prompt) + len(system_prompt or "")
                        resp_len = len(response_text)
                        prompt_tokens = max(1, prompt_len // 4)
                        completion_tokens = max(1, resp_len // 4)
                        
                        # Claude 3.5 Sonnet pricing
                        input_rate = 3.0 / 1_000_000
                        output_rate = 15.0 / 1_000_000
                        cost = (prompt_tokens * input_rate) + (completion_tokens * output_rate)
                        
                        ai_call = AICall(
                            finding_id=finding_id,
                            scan_id=scan_id,
                            call_type=call_type,
                            prompt=prompt,
                            response=response_text,
                            provider="anthropic",
                            model=model_to_use,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            cost=cost
                        )
                        db.add(ai_call)
                        db.commit()
                    except Exception as log_ex:
                        logger.error(f"Failed to log AI call: {log_ex}")

                return response_text
            except Exception as e:
                if attempt < max_attempts - 1:
                    time.sleep(1.5 ** attempt)
                    continue
                logger.error(f"Failed to communicate with Anthropic API: {e}")
                return f"AI Analysis pending... (Anthropic service error: {e})"

    def _call_model_with_model_override(self, prompt: str, model_override: str = None, system_prompt: str = None, db: Any = None, finding_id: Any = None, scan_id: Any = None, call_type: str = None) -> str:
        if self.provider == "anthropic":
            return self._call_anthropic(prompt, model_override, system_prompt, db, finding_id, scan_id, call_type)
        else:
            return self._call_ollama(prompt, model_override, system_prompt, db, finding_id, scan_id, call_type)

    def _parse_json_response(self, text: str, default_val: dict) -> dict:
        """
        Safely parses JSON from LLM response, stripping markdown blocks if present.
        """
        import json
        import re
        if not text:
            return default_val
        
        cleaned = text.strip()
        # Find JSON codeblock
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1)
        else:
            # Fallback search for first '{' and last '}'
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1:
                cleaned = cleaned[start:end+1]
        
        try:
            return json.loads(cleaned)
        except Exception as e:
            logger.warning(f"Failed to parse LLM JSON response: {e}. Raw: {text}")
            return default_val

    def generate_remediation_patch(self, title: str, tool: str, description: str, cve_id: str) -> dict:
        """
        Generates a code diff patch or remediation scripts using deepseek-coder:6.7b or fallbacks.
        """
        target_model = self.model
        if self.provider == "ollama" and "deepseek-coder:6.7b" in self.local_models:
            target_model = "deepseek-coder:6.7b"

        prompt = (
            f"You are an automated security patch generation bot. Generate a git diff patch or remediation code block "
            f"to resolve the following security vulnerability.\n"
            f"Output ONLY a valid JSON object with exactly two fields:\n"
            f'1. "patch": string, containing the unified diff patch or remediation code snippet.\n'
            f'2. "remediation_steps": array of strings, containing step-by-step instructions or commands.\n\n'
            f"Do not include any explanation, greeting, or markdown formatting outside the JSON.\n\n"
            f"Vulnerability Title: {title}\n"
            f"CVE ID: {cve_id if cve_id else 'N/A'}\n"
            f"Tool: {tool}\n"
            f"Description: {description}\n"
        )

        response_text = self._call_model_with_model_override(prompt, target_model)
        return self._parse_json_response(response_text, {"patch": "", "remediation_steps": []})

    def analyze_reachability(self, title: str, tool: str, description: str) -> dict:
        """
        Classifies reachability of the vulnerability and generates a mock call-site or explanation.
        """
        prompt = (
            f"You are a static analysis security tool. Analyze the vulnerability scan finding below and determine "
            f"if it is 'reachable' (actively referenced or called in codebase execution path), "
            f"'unreachable' (defined as a dependency but not imported or executed), or 'uncertain'.\n"
            f"Output ONLY a valid JSON object with exactly two fields:\n"
            f'1. "reachability": string, exactly one of "reachable", "unreachable", or "uncertain"\n'
            f'2. "reachability_reason": string, containing a detailed analysis, mock call-site code block, or explanation.\n\n'
            f"Do not include any explanation, greeting, or markdown formatting outside the JSON.\n\n"
            f"Vulnerability Title: {title}\n"
            f"Tool: {tool}\n"
            f"Description: {description}\n"
        )

        response_text = self._call_model_with_model_override(prompt, self.model)
        return self._parse_json_response(response_text, {"reachability": "uncertain", "reachability_reason": "Analysis pending."})

    def analyze_severity_override(self, title: str, original_severity: str, asset_name: str, asset_type: str, asset_weight: float) -> dict:
        """
        Reviews vulnerability severity in the context of the asset weight and properties.
        """
        prompt = (
            f"You are an expert security architect. Review the severity of the security finding below in the context of the "
            f"target asset's weight (criticality scale where 0.5 is Low, 1.0 is Medium, 1.5 is High, 2.0 is Critical) and details.\n"
            f"Output ONLY a valid JSON object with exactly two fields:\n"
            f'1. "severity_override": string, exactly one of "critical", "high", "medium", "low", "info" (or the original severity if no override is needed)\n'
            f'2. "override_reason": string, explaining why the severity was adjusted or kept same based on asset context.\n\n'
            f"Do not include any explanation, greeting, or markdown formatting outside the JSON.\n\n"
            f"Vulnerability Title: {title}\n"
            f"Original Severity: {original_severity}\n"
            f"Asset Name: {asset_name}\n"
            f"Asset Type: {asset_type}\n"
            f"Asset Weight (Criticality): {asset_weight}\n"
        )

        response_text = self._call_model_with_model_override(prompt, self.model)
        return self._parse_json_response(response_text, {"severity_override": original_severity, "override_reason": "Original severity retained."})



if __name__ == "__main__":
    # Test script execution
    print("==================================================")
    print("  SIGMASEC SECURITY PLATFORM — AI CLIENT TEST")
    print("==================================================")
    print(f"Target Provider : {AI_PROVIDER.upper()}")
    print(f"Target Model    : {AI_MODEL}")
    if AI_PROVIDER == "ollama":
        print(f"Ollama Endpoint : {OLLAMA_API_BASE}")
    print("--------------------------------------------------")

    client = AIClient()
    
    # Sample CVE Context
    test_cve = "CVE-2023-45853"
    test_severity = "CRITICAL"
    test_title = "zlib: heap-based buffer overflow in zipOpenNewFileInZip4_64"
    test_description = (
        "An integer overflow and resultant heap-based buffer overflow can occur in zipOpenNewFileInZip4_64 "
        "in minizip in zlib through 1.3.0.1 when a filename, extra field, or comment has a length that "
        "exceeds the capacity of a certain buffer size calculations, potentially leading to remote code execution."
    )
    
    print(f"Sending Vulnerability context for: {test_cve}")
    print("Waiting for response...\n")
    
    analysis = client.analyze_vulnerability(
        cve_id=test_cve,
        severity=test_severity,
        title=test_title,
        description=test_description
    )
    
    print("=== MODEL RESPONSE ===")
    print(analysis)
    print("==================================================")
