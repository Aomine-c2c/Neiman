"""
NEIMAN Security & Boundary Isolation Kernel.
Implements:
1. Least privilege permission matrix between:
   COMPANY -> DEPARTMENT -> AGENT -> MODEL -> TOOL -> RESOURCE
2. Cryptographic secret masking & API key scrubbing
3. Prompt injection detection & adversarial pattern filtering
4. Tool execution sandboxing:
   - Filesystem path traversal protection (chroot / workspace jail)
   - Terminal command whitelisting & prohibited pattern detection
   - Network / External API egress filtering
   - Database mutation boundaries
5. Untrusted model output validation & code execution prevention
6. Audit log cryptographic integrity hashing (HMAC-SHA256 tamper-evident chaining)
7. Minimal authorized context enforcement & PII scrubbing before external LLM dispatch
"""

import hashlib
import hmac
import ipaddress
import re
import socket
import uuid
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from urllib.parse import urlsplit

from nexora.config import get_settings
from nexora.exceptions import ForbiddenError, ValidationError

try:
    import neiman_native  # type: ignore

    HAS_RUST_NATIVE = True
except ImportError:
    HAS_RUST_NATIVE = False


# ── 1. Permission Matrix & Boundary Hierarchy ─────────────────────────────────


class ResourceDomain(str, Enum):
    COMPANY = "COMPANY"
    DEPARTMENT = "DEPARTMENT"
    AGENT = "AGENT"
    MODEL = "MODEL"
    TOOL = "TOOL"
    RESOURCE = "RESOURCE"


class ToolCategory(str, Enum):
    FILESYSTEM = "FILESYSTEM"
    TERMINAL = "TERMINAL"
    BROWSER = "BROWSER"
    DATABASE = "DATABASE"
    EXTERNAL_API = "EXTERNAL_API"
    COMPUTE = "COMPUTE"
    ANALYSIS = "ANALYSIS"


@dataclass
class SecurityContext:
    company_id: uuid.UUID
    department_id: uuid.UUID | None = None
    agent_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    role: str = "MEMBER"
    autonomy_level: int = 2
    assigned_capabilities: list[str] = field(default_factory=list)
    allowed_tools: list[str] = field(default_factory=list)
    allowed_file_paths: list[str] = field(default_factory=list)
    max_budget_usd: float = 10.0


# ── 2. Prompt Injection & Malicious Pattern Scanner ───────────────────────────

PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|directions)",
    r"disregard\s+(your\s+)?(rules|safeguards|instructions|guidelines)",
    r"system\s+prompt\s*:\s*you\s+are\s+now",
    r"you\s+are\s+no\s+longer\s+an?\s+ai",
    r"switch\s+to\s+developer\s+mode",
    r"dan\s+mode\s+enabled",
    r"jailbreak",
    r"base64\s+decode\s+and\s+execute",
    r"<script[\s\S]*?>[\s\S]*?<\/script>",
    r"drop\s+table\s+",
    r"rm\s+-rf\s+[\/~]",
    r":\(\)\{\s*:\|\:&\s*\};:",  # Fork bomb
]

SECRETS_PATTERNS = [
    r"(?:api[_-]?key|secret|token|password|bearer|auth|private[_-]?key)\s*[:=]\s*['\"]?([a-zA-Z0-9_\-\.]{16,})['\"]?",
    r"sk-[a-zA-Z0-9]{20,}",  # OpenAI API key pattern
    r"ghp_[a-zA-Z0-9]{36,}",  # GitHub Personal Access Token
    r"eyJh[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}",  # JWT Token
    r"AKIA[0-9A-Z]{16}",  # AWS Access Key ID
]

PII_PATTERNS = [
    (r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_SSN]"),
    (r"\b4[0-9]{12}(?:[0-9]{3})?\b", "[REDACTED_CC]"),  # Visa
    (r"\b5[1-5][0-9]{14}\b", "[REDACTED_CC]"),  # MasterCard
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b", "[REDACTED_EMAIL]"),
]

# Hostnames that expose cloud instance credentials and must never be used as an
# inference endpoint, regardless of the provider's local/self-hosted flag.
_METADATA_HOSTNAMES = frozenset(
    {
        "metadata.google.internal",
        "metadata.goog",
        "instance-data",
        "metadata",
    }
)


class PromptSanitizer:
    """Detects adversarial injection attacks and scrubs sensitive data."""

    @staticmethod
    def scan_for_injection(text: str) -> tuple[bool, str | None]:
        if not text:
            return False, None
        for pattern in PROMPT_INJECTION_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return (
                    True,
                    f"Detected malicious instruction / injection pattern: '{match.group(0)}'",
                )
        return False, None

    @staticmethod
    def scrub_secrets(text: str) -> str:
        if not text:
            return text
        scrubbed = text
        for pattern in SECRETS_PATTERNS:
            scrubbed = re.sub(pattern, "[REDACTED_SECRET]", scrubbed, flags=re.IGNORECASE)
        return scrubbed

    @staticmethod
    def scrub_pii(text: str) -> str:
        if not text:
            return text
        scrubbed = text
        for pattern, replacement in PII_PATTERNS:
            scrubbed = re.sub(pattern, replacement, scrubbed)
        return scrubbed

    @classmethod
    def sanitize_for_external_llm(cls, text: str) -> str:
        """
        Enforces least-privilege context transmission:
        Scrubs embedded credentials, API keys, and sensitive customer PII before sending to external model APIs.
        """
        step1 = cls.scrub_secrets(text)
        return cls.scrub_pii(step1)


# ── 3. Tool Sandboxing & Execution Boundary ───────────────────────────────────

DISALLOWED_TERMINAL_PATTERNS = [
    r"rm\s+-(?:r|f|rf|fr)\b",
    r":\(\)\{\s*:\|\:&\s*\};:",
    r"\bmkfs\b",
    r"\bdd\s+if=",
    r"\bchmod\s+(?:-R\s+)?777\b",
    r"\bsudo\b",
    r"\bsu\s+-",
    r"curl.*\|\s*bash",
    r"wget.*\|\s*sh",
    r"\bnc\s+-e\b",
    r"/etc/shadow",
    r"/etc/passwd",
    r"\bshutdown\b",
    r"\breboot\b",
    r"\biptables\s+-f\b",
]


DISALLOWED_SQL_PATTERNS = [
    r"drop\s+database",
    r"drop\s+table",
    r"truncate\s+table",
    r"alter\s+table.*drop\s+column",
    r"grant\s+all\s+privileges",
]


class ToolSandbox:
    """Enforces fine-grained sandboxing per tool category."""

    @staticmethod
    def validate_filesystem_access(
        target_path: str,
        allowed_directories: list[str],
        writable: bool = False,
    ) -> None:
        """
        Path traversal validation. Prevents ../ and access to system files (/etc, /proc, /sys).
        """
        if not target_path:
            raise ValidationError("Filesystem target path cannot be empty.")

        if not allowed_directories:
            raise ForbiddenError("Filesystem access denied: no permitted directories configured.")

        # Resolve symlinks as well as '..' components before checking containment.
        # commonpath compares path components, unlike string-prefix checks.
        normalized = Path(target_path).resolve(strict=False)
        blocked_roots = (Path("/etc"), Path("/proc"), Path("/sys"), Path("/root"))
        if any(normalized == root or root in normalized.parents for root in blocked_roots):
            raise ForbiddenError(f"Filesystem access to protected path rejected: '{target_path}'.")

        is_allowed = False
        for allowed in allowed_directories:
            allowed_norm = Path(allowed).resolve(strict=False)
            try:
                normalized.relative_to(allowed_norm)
                is_allowed = True
                break
            except ValueError:
                continue

        if not is_allowed:
            raise ForbiddenError(
                f"Access denied to '{target_path}'. Out of permitted directory boundaries: {allowed_directories}"
            )

    @staticmethod
    def validate_terminal_command(command: str) -> None:
        """
        Terminal command validation against malicious shell patterns and privilege escalation.
        """
        if not command:
            raise ValidationError("Terminal command cannot be empty.")

        for pattern in DISALLOWED_TERMINAL_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                raise ForbiddenError(
                    f"Command '{command}' rejected: matches high-risk prohibited shell pattern '{pattern}'."
                )

    @staticmethod
    def validate_database_query(query: str, allow_destructive: bool = False) -> None:
        """
        Database command inspection to prevent unauthorized drop/truncate operations.
        """
        if not allow_destructive:
            for pattern in DISALLOWED_SQL_PATTERNS:
                if re.search(pattern, query, re.IGNORECASE):
                    raise ForbiddenError(
                        f"Destructive database operation rejected without executive override: '{query}'."
                    )

    @staticmethod
    def validate_external_url(url: str, allowed_domains: list[str] | None = None) -> None:
        """
        SSRF & Egress filtering: Blocks cloud metadata endpoints (169.254.169.254) and localhost egress.
        """
        try:
            parsed = urlsplit(url)
            hostname = (parsed.hostname or "").rstrip(".").lower()
        except ValueError as exc:
            raise ValidationError("Outbound URL is malformed.") from exc

        try:
            address = ipaddress.ip_address(hostname) if hostname else None
        except ValueError:
            address = None

        if parsed.scheme not in {"http", "https"} or not hostname:
            raise ValidationError("Outbound URL must use HTTP or HTTPS and include a hostname.")

        if hostname == "metadata.google.internal":
            raise ForbiddenError("Access to internal cloud metadata service is strictly blocked.")
        if address is not None:
            if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
                address = address.ipv4_mapped
            if not address.is_global:
                raise ForbiddenError("Outbound URLs may not target non-public IP addresses.")
        if hostname == "localhost":
            raise ForbiddenError("Egress loopback access to internal host ports is prohibited.")

        if allowed_domains:
            # Compare DNS labels exactly; substrings allow attacker-controlled suffixes.
            approved = {domain.rstrip(".").lower() for domain in allowed_domains}
            if hostname not in approved:
                raise ForbiddenError(
                    f"Outbound URL '{url}' is not in approved external domain whitelist: {allowed_domains}"
                )

    @staticmethod
    async def validate_external_url_async(
        url: str, allowed_domains: list[str] | None = None
    ) -> None:
        """Validate URL syntax and DNS results before outbound network access."""
        ToolSandbox.validate_external_url(url, allowed_domains=allowed_domains)
        await ToolSandbox.validate_provider_endpoint_async(url)

    @staticmethod
    async def validate_httpx_request(request) -> None:
        """Validate each outbound HTTPX request, including every redirect hop."""
        await ToolSandbox.validate_external_url_async(str(request.url))

    @staticmethod
    def validate_provider_endpoint(
        url: str, allow_loopback: bool = False, allow_private: bool = False
    ) -> str:
        """
        Validates a tenant-supplied AI provider endpoint (`ModelProvider.base_url`).

        The endpoint is later used by the intelligence adapters to forward the
        provider's decrypted API key and the user's prompt. Without validation a
        tenant can point a provider at an internal host and harvest the key, so:

        - Only http/https with a hostname are accepted (no file://, gopher://, ...).
        - Embedded credentials (`https://user:pass@host`) are rejected.
        - Cloud metadata endpoints are ALWAYS rejected, even for local providers.
        - Loopback and RFC1918 private ranges are rejected unless the provider is
          explicitly flagged as a local / self-hosted deployment.

        Returns the normalized endpoint. Raises ValidationError / ForbiddenError.
        """
        if url is None or not str(url).strip():
            raise ValidationError("Provider endpoint URL cannot be empty.")

        candidate = str(url).strip()
        try:
            parsed = urlsplit(candidate)
            hostname = (parsed.hostname or "").rstrip(".").lower()
        except ValueError as exc:
            raise ValidationError("Provider endpoint URL is malformed.") from exc

        if parsed.scheme not in {"http", "https"}:
            raise ValidationError(
                f"Provider endpoint must use http or https (got '{parsed.scheme or 'none'}')."
            )
        if not hostname:
            raise ValidationError("Provider endpoint must include a hostname.")
        if parsed.username or parsed.password:
            raise ValidationError(
                "Provider endpoint must not embed credentials; use the API key field instead."
            )

        # Cloud metadata services are never a legitimate inference endpoint.
        if hostname in _METADATA_HOSTNAMES:
            raise ForbiddenError(
                "Provider endpoint may not target the cloud metadata service."
            )

        try:
            address = ipaddress.ip_address(hostname)
        except ValueError:
            address = None

        if address is not None:
            if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
                address = address.ipv4_mapped
            if not address.is_global:
                permitted_local = (address.is_loopback and allow_loopback) or (
                    not address.is_loopback and address.is_private and allow_private
                )
                if not permitted_local:
                    raise ForbiddenError(
                        "Provider endpoint may not target a non-public network address."
                    )
            if address.is_link_local or address.is_multicast or address.is_reserved:
                raise ForbiddenError(
                    "Provider endpoint may not target a link-local, multicast or reserved address."
                )

        return candidate

    @staticmethod
    async def validate_provider_endpoint_async(
        url: str, allow_loopback: bool = False, allow_private: bool = False
    ) -> str:
        """
        DNS-aware variant of `validate_provider_endpoint`.

        Resolves the hostname off the event loop and re-validates every resolved
        address, which closes the DNS-rebinding hole where a public-looking host
        resolves to 169.254.169.254 or an internal RFC1918 address.
        """
        import asyncio

        normalized = ToolSandbox.validate_provider_endpoint(
            url, allow_loopback=allow_loopback, allow_private=allow_private
        )
        parsed = urlsplit(normalized)
        hostname = (parsed.hostname or "").rstrip(".").lower()
        if not hostname:
            return normalized

        try:
            ipaddress.ip_address(hostname)
        except ValueError:
            pass
        else:
            # Literal IP addresses were already validated synchronously.
            return normalized

        try:
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            loop = asyncio.get_running_loop()
            infos = await loop.getaddrinfo(
                hostname, port, type=socket.SOCK_STREAM, proto=socket.IPPROTO_TCP
            )
        except (OSError, ValueError) as exc:
            raise ValidationError(
                f"Provider endpoint hostname '{hostname}' could not be resolved."
            ) from exc

        for info in infos:
            address = ipaddress.ip_address(info[4][0])
            if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
                address = address.ipv4_mapped
            if not address.is_global:
                permitted_local = (address.is_loopback and allow_loopback) or (
                    not address.is_loopback and address.is_private and allow_private
                )
                if not permitted_local:
                    raise ForbiddenError(
                        "Provider endpoint hostname resolves to a non-public network address."
                    )
            if address.is_link_local or address.is_multicast or address.is_reserved:
                raise ForbiddenError(
                    "Provider endpoint hostname resolves to a blocked link-local, "
                    "multicast or reserved address."
                )
            if address.is_loopback and not allow_loopback:
                raise ForbiddenError(
                    "Provider endpoint hostname resolves to a loopback address."
                )
            if address.is_private and not (allow_loopback or allow_private):
                raise ForbiddenError(
                    "Provider endpoint hostname resolves to a private network range."
                )
        return normalized


# ── 4. Untrusted Model Output & Instruction Boundary ──────────────────────────


class ModelOutputBoundary:
    """
    Treats all model output as untrusted.
    Validates that model cannot inject instructions disguised as system commands.
    """

    @staticmethod
    def inspect_output_for_instruction_smuggling(model_output: str) -> tuple[bool, str | None]:
        """
        Checks if model response attempts to smuggle system command payloads or unauthorized triggers.
        """
        if HAS_RUST_NATIVE:
            try:
                neiman_native.py_validate_payload(model_output, 65536)
            except ValueError as err:
                return (
                    True,
                    f"Output contained smuggled instruction (Rust Zero-Trust Engine): '{err}'",
                )

        smuggling_patterns = [
            r"\[SYSTEM_COMMAND\]\s*(.*)",
            r"\[EXECUTE_ROOT\]\s*(.*)",
            r"<\s*script\s*>\s*alert\(",
            r"EVAL_JS:\s*(.*)",
        ]
        for pattern in smuggling_patterns:
            match = re.search(pattern, model_output, re.IGNORECASE)
            if match:
                return True, f"Output contained smuggled instruction: '{match.group(0)}'"
        return False, None


# ── 5. Audit Log Cryptographic Integrity Chaining ─────────────────────────────


class AuditIntegrityChamber:
    """
    HMAC-SHA256 signature and tamper-evident chaining for governance and execution audit records.
    Ensures an insider or compromised agent cannot silently rewrite history.
    """

    SECRET_SALT = b"NEIMAN_audit_cryptographic_anchor_v1"

    @classmethod
    def _get_audit_salt(cls) -> bytes:
        salt = get_settings().AUDIT_SECRET_SALT
        return salt.encode("utf-8") if isinstance(salt, str) else salt

    @classmethod
    def _canonical_timestamp(cls, timestamp: str) -> str:
        # Standardize timestamp string: normalize +00:00 or Z
        if not timestamp:
            return ""
        ts = timestamp.replace("+00:00", "").replace("Z", "")
        return ts

    @classmethod
    def compute_record_signature(
        cls,
        audit_id: str,
        company_id: str,
        actor_id: str,
        action: str,
        target: str,
        result: str,
        timestamp: str,
        previous_signature: str = "GENESIS",
    ) -> str:
        canonical_ts = cls._canonical_timestamp(timestamp)
        canonical_str = f"{audit_id}:{company_id}:{actor_id}:{action}:{target}:{result}:{canonical_ts}:{previous_signature}"
        return hmac.new(
            cls._get_audit_salt(), canonical_str.encode("utf-8"), hashlib.sha256
        ).hexdigest()

    @classmethod
    def verify_record_signature(
        cls,
        audit_id: str,
        company_id: str,
        actor_id: str,
        action: str,
        target: str,
        result: str,
        timestamp: str,
        signature: str,
        previous_signature: str = "GENESIS",
    ) -> bool:
        expected = cls.compute_record_signature(
            audit_id, company_id, actor_id, action, target, result, timestamp, previous_signature
        )
        return hmac.compare_digest(expected, signature)


# ── 8. Filler Scrubber & High-Density Token Compressor ────────────────────────


class FillerScrubber:
    """
    Strips conversational filler, discursive meta-commentary, and pleasantries.
    Compresses bloated natural language outputs into high-density technical fragments.
    Preserves:
    - Code blocks & syntax formatting
    - URLs & file paths
    - Key technical metrics, IDs, hashes, and error messages
    """

    # Opening conversational pleasantries and filler phrases
    _PREAMBLE_PATTERNS = [
        r"^(?:(?:Certainly|Sure|Sure thing|Of course|Alright|Okay|Great|Got it|Understood|No problem)[!.,\s]*)+",
        r"^(?:Here (?:is|are)(?: the)?|Below (?:is|are)(?: the)?|Please find(?: the)?)[^:\n]*:?\s*",
        r"^(?:I(?:'d| would)? (?:be happy|like) to (?:help|assist|provide)[^:\n]*:?\s*)",
        r"^(?:As an AI (?:language model|assistant)[^,\n]*,?\s*)",
        r"^(?:Based on your request|According to your request|As requested)[^,\n]*,?\s*",
        r"^(?:In response to your query|Regarding your question)[^,\n]*,?\s*",
    ]

    # Transitional and conversational hedging mid-text
    _HEDGING_PATTERNS = [
        r"(?i)\b(?:please note that|it is important to (?:note|remember) that|keep in mind that)\b\s*",
        r"(?i)\b(?:feel free to (?:let me know|ask|reach out)|don't hesitate to reach out)\b[.!?,]?",
        r"(?i)\b(?:hope this helps|let me know if you need anything else|let me know if you have any questions)\b[.!?,]?",
        r"(?i)\b(?:as (?:mentioned|stated|discussed) earlier|as you (?:may )?know)\b,?\s*",
    ]

    # Meta wrap-up phrases
    _POSTAMBLE_PATTERNS = [
        r"(?i)(?:\n\s*)?(?:In summary|To summarize|In conclusion|Overall)[^:\n]*:?\s*",
        r"(?i)(?:\n\s*)?(?:Summary:\s*)",
    ]

    @classmethod
    def strip_filler(cls, text: str) -> str:
        """
        Removes introductory pleasantries, polite hedges, and closing meta-filler
        while strictly preserving code blocks, json blocks, and technical content.
        """
        if not text or not text.strip():
            return ""

        # Protect markdown code blocks during scrubbing
        code_blocks: list[str] = []

        def _extract_code(match: re.Match) -> str:
            code_blocks.append(match.group(0))
            return f"__CODE_BLOCK_{len(code_blocks) - 1}__"

        processed = re.sub(r"```[\s\S]*?```", _extract_code, text)

        # 1. Strip preambles from beginning of text (loop until stable)
        changed = True
        while changed:
            changed = False
            for pat in cls._PREAMBLE_PATTERNS:
                new_processed = re.sub(pat, "", processed, flags=re.IGNORECASE).lstrip()
                if new_processed != processed:
                    processed = new_processed
                    changed = True

        # 2. Strip conversational hedging patterns
        for pat in cls._HEDGING_PATTERNS:
            processed = re.sub(pat, "", processed, flags=re.IGNORECASE)

        # 3. Strip closing meta-summaries if redundant
        for pat in cls._POSTAMBLE_PATTERNS:
            processed = re.sub(pat, "", processed, flags=re.IGNORECASE)

        # 4. Clean extra trailing/leading whitespace and double empty lines
        processed = re.sub(r"\n{3,}", "\n\n", processed).strip()

        # 5. Restore code blocks
        for idx, block in enumerate(code_blocks):
            processed = processed.replace(f"__CODE_BLOCK_{idx}__", block)

        return processed

    @classmethod
    def compress_to_fragments(cls, text: str) -> str:
        """
        Cleans conversational filler and converts loose narrative paragraphs
        into dense, fragment-structured bullet clauses where appropriate.
        """
        cleaned = cls.strip_filler(text)
        if not cleaned:
            return ""

        # If already formatted with lists, bullets, or code, return stripped text
        lines = cleaned.splitlines()
        has_structural_formatting = any(
            line.strip().startswith(("-", "*", "1.", "2.", "3.", "#", "```", "|")) for line in lines
        )
        if has_structural_formatting:
            return cleaned

        # Otherwise convert discursive multi-sentence paragraphs into clean fragments
        paragraphs = [p.strip() for p in cleaned.split("\n\n") if p.strip()]
        dense_clauses: list[str] = []

        for p in paragraphs:
            # Split sentences
            sentences = re.split(r"(?<=[.!?])\s+", p)
            for s in sentences:
                s_clean = s.strip()
                if not s_clean:
                    continue
                # Strip weak transitional words at sentence starts
                s_clean = re.sub(
                    r"^(?:Additionally|Furthermore|Moreover|In addition|Also|However|Therefore|Thus|Hence|Consequently|Basically|Essentially)[,\s]+",
                    "",
                    s_clean,
                    flags=re.IGNORECASE,
                ).strip()
                if s_clean:
                    dense_clauses.append(s_clean)

        if len(dense_clauses) > 1:
            return "\n".join(f"- {c}" for c in dense_clauses)
        return cleaned
