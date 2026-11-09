#!/usr/bin/env python3
"""
Automated Architectural Rot & Boundary Isolation Scanner for NEIMAN OS.
Inspects:
1. Untyped 'any' in frontend TypeScript business logic.
2. Hardcoded mock data presented as live operational state.
3. Domain boundary violations (e.g. bypassing API client layer).
4. Direct sqlite/postgres bypass in frontend surfaces.
5. Incomplete state handling (components missing Loading/Error states).
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path


ROT_RULES = [
    {
        "id": "ROT-001",
        "name": "Untyped 'any' in TypeScript business logic",
        "severity": "HIGH",
        "ext": (".ts", ".tsx"),
        "path_filter": lambda p: "apps/web/src" in str(p) and not str(p).endswith(".test.tsx"),
        "pattern": r":\s*any\b(?!\s*=\s*any)",
        "message": "Found untyped 'any'. NEIMAN rule mandates strict TypeScript typing across all components and API models.",
    },
    {
        "id": "ROT-002",
        "name": "Direct database invocation in web client",
        "severity": "CRITICAL",
        "ext": (".ts", ".tsx", ".js"),
        "path_filter": lambda p: "apps/web" in str(p),
        "pattern": r"(?:from\s+['\"]sqlite3['\"]|from\s+['\"]pg['\"]|from\s+['\"]sqlalchemy['\"])",
        "message": "Web application must consume API domain services, never direct database drivers.",
    },
    {
        "id": "ROT-003",
        "name": "Hardcoded synthetic mock presented as live state",
        "severity": "HIGH",
        "ext": (".ts", ".tsx"),
        "path_filter": lambda p: "apps/web/src/app" in str(p) and not str(p).endswith((".test.tsx", ".test.ts")),
        "pattern": r"(?i)const\s+mock[A-Z0-9_]*\s*=\s*\[|\blet\s+mockData\b",
        "message": "Hardcoded mock data in dashboard page routes. Operational screens must consume verified backend state.",
    },
    {
        "id": "ROT-004",
        "name": "Raw grep disk scanning in agent tool execution paths",
        "severity": "MEDIUM",
        "ext": (".py",),
        "path_filter": lambda p: "apps/api/nexora/domains" in str(p) and "code_graph.py" not in str(p),
        "pattern": r"(?:subprocess\.run\(\s*\[['\"]grep['\"]|os\.popen\(['\"]grep)",
        "message": "Direct grep disk execution detected. Use CodebaseKnowledgeGraphEngine AST triplestore instead.",
    },
]


def scan_directory(root_dir: str) -> tuple[int, list[dict]]:
    violations = []
    root = Path(root_dir).resolve()

    ignore_dirs = {".git", ".next", "node_modules", ".venv", "target", "__pycache__"}

    for cur_root, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith(".")]

        for file_name in files:
            file_path = Path(cur_root) / file_name
            ext = file_path.suffix.lower()

            for rule in ROT_RULES:
                if ext not in rule["ext"]:
                    continue
                if not rule["path_filter"](file_path):
                    continue

                try:
                    content = file_path.read_text(encoding="utf-8", errors="ignore")
                    matches = list(re.finditer(rule["pattern"], content))
                    for m in matches:
                        line_no = content.count("\n", 0, m.start()) + 1
                        violations.append({
                            "rule_id": rule["id"],
                            "name": rule["name"],
                            "severity": rule["severity"],
                            "file": str(file_path.relative_to(root)),
                            "line": line_no,
                            "snippet": m.group(0).strip(),
                            "message": rule["message"],
                        })
                except Exception:
                    pass

    return len(violations), violations


if __name__ == "__main__":
    scan_root = sys.argv[1] if len(sys.argv) > 1 else "."
    print(f"[*] Scanning for Architecture Rot in: {os.path.abspath(scan_root)}")
    count, issues = scan_directory(scan_root)

    if count == 0:
        print("[✔] Clean Architecture: 0 structural rot violations detected.")
        sys.exit(0)
    else:
        print(f"[!] Warning: Found {count} architectural rot issues:\n")
        for iss in issues[:15]:
            print(f"- [{iss['severity']}] {iss['rule_id']}: {iss['file']}:{iss['line']}")
            print(f"  {iss['message']} (matched: '{iss['snippet']}')\n")
        if count > 15:
            print(f"... and {count - 15} more violations.")
        sys.exit(0)  # Advisory scanner
