"""Workspace and Codebase Inspector for Autonomous Project Setup & Indexing."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from nexora.core.security import PromptSanitizer
from nexora.domains.projects.schemas import WorkspaceInspectionResult


def _workspace_file(root: Path, name: str) -> Path | None:
    """Resolve a workspace file while rejecting symlinks that escape the root."""
    try:
        resolved = (root / name).resolve(strict=True)
        resolved.relative_to(root)
    except (OSError, ValueError):
        return None
    return resolved if resolved.is_file() else None


def _safe_git_remote(remote: str) -> str:
    """Remove credentials and query/fragment data from a Git remote before returning it."""
    parsed = urlsplit(remote)
    if parsed.scheme and parsed.hostname:
        host = parsed.hostname
        if parsed.port:
            host = f"{host}:{parsed.port}"
        return urlunsplit((parsed.scheme, host, parsed.path, "", ""))
    if "@" in remote:
        remote = remote.rsplit("@", 1)[1]
    return remote.split("?", 1)[0].split("#", 1)[0]


class WorkspaceInspector:
    """Discovers, indexes, and analyzes local directory trees and existing repositories."""

    @staticmethod
    def inspect(target_path: str) -> WorkspaceInspectionResult:
        p = Path(os.path.expanduser(target_path)).resolve()
        workspace_root = Path(os.environ.get("NEIMAN_WORKSPACE_ROOT", os.getcwd())).expanduser().resolve()
        if p != workspace_root and workspace_root not in p.parents:
            return WorkspaceInspectionResult(
                target_path=str(p),
                is_existing_codebase=False,
                project_name=p.name or "new_project",
                primary_language="Unknown",
                detected_frameworks=[],
                summary="Target path is outside the configured workspace root.",
                key_components=[],
                suggested_initiatives=["Choose a directory inside the configured workspace root"],
            )
        if not p.exists() or not p.is_dir():
            return WorkspaceInspectionResult(
                target_path=str(p),
                is_existing_codebase=False,
                project_name=p.name or "new_project",
                primary_language="Unknown",
                detected_frameworks=[],
                summary="Directory does not exist or is not a directory.",
                key_components=[],
                suggested_initiatives=[
                    "Initialize project scaffolding and directory hierarchy",
                    "Configure primary programming language and package manifests",
                    "Establish automated test suite and verification harness",
                ],
            )

        entries = [
            e.name
            for e in p.iterdir()
            if not e.name.startswith(".") and e.name not in ("node_modules", "target", ".venv", "__pycache__")
        ]

        if not entries:
            return WorkspaceInspectionResult(
                target_path=str(p),
                is_existing_codebase=False,
                project_name=p.name,
                primary_language="Unspecified",
                detected_frameworks=[],
                summary="Empty directory container ready for new project scaffolding.",
                key_components=[],
                suggested_initiatives=[
                    "Bootstrap project structure and dependencies",
                    "Specify technical architecture and interface contracts",
                    "Set up initial implementation and verification suite",
                ],
            )

        # Detect Manifests & Languages
        detected_frameworks: list[str] = []
        languages: list[str] = []
        key_components: list[str] = []

        cargo_file = _workspace_file(p, "Cargo.toml")
        package_file = _workspace_file(p, "package.json")
        pyproject_file = _workspace_file(p, "pyproject.toml")
        requirements_file = _workspace_file(p, "requirements.txt")
        go_file = _workspace_file(p, "go.mod")
        has_cargo = cargo_file is not None
        has_package_json = package_file is not None
        has_pyproject = pyproject_file is not None or requirements_file is not None
        has_go = go_file is not None

        if has_cargo:
            languages.append("Rust")
            try:
                cargo_text = cargo_file.read_text(encoding="utf-8", errors="ignore")
                for fw in ("ratatui", "crossterm", "tokio", "axum", "actix-web", "tauri", "serde"):
                    if fw in cargo_text:
                        detected_frameworks.append(fw)
            except Exception:
                pass

        if has_package_json:
            languages.append("TypeScript/JavaScript")
            try:
                pkg_data = json.loads(package_file.read_text(encoding="utf-8", errors="ignore"))
                deps: dict[str, Any] = {
                    **pkg_data.get("dependencies", {}),
                    **pkg_data.get("devDependencies", {}),
                }
                for fw in ("next", "react", "tailwindcss", "vite", "vue", "express", "jest"):
                    if fw in deps:
                        detected_frameworks.append(fw)
            except Exception:
                pass

        if has_pyproject:
            languages.append("Python")
            try:
                txt = ""
                if pyproject_file:
                    txt += pyproject_file.read_text(encoding="utf-8", errors="ignore")
                if requirements_file:
                    txt += requirements_file.read_text(encoding="utf-8", errors="ignore")
                for fw in ("fastapi", "sqlalchemy", "pydantic", "pytest", "ruff", "mypy", "django", "flask"):
                    if fw in txt.lower():
                        detected_frameworks.append(fw)
            except Exception:
                pass

        if has_go:
            languages.append("Go")

        # Fallback language inspection from extensions
        if not languages:
            ext_counts: dict[str, int] = {}
            for item in p.rglob("*"):
                if any(ignored in item.parts for ignored in ("node_modules", "target", ".venv", ".git", "dist")):
                    continue
                if item.is_file() and not item.is_symlink():
                    ext = item.suffix.lower()
                    if ext in (".py", ".rs", ".ts", ".tsx", ".js", ".jsx", ".go", ".cpp", ".c", ".java"):
                        ext_counts[ext] = ext_counts.get(ext, 0) + 1
            if ext_counts:
                top_ext = max(ext_counts, key=ext_counts.get)  # type: ignore[arg-type]
                lang_map = {
                    ".py": "Python",
                    ".rs": "Rust",
                    ".ts": "TypeScript",
                    ".tsx": "TypeScript/React",
                    ".js": "JavaScript",
                    ".go": "Go",
                    ".java": "Java",
                    ".cpp": "C++",
                }
                languages.append(lang_map.get(top_ext, "Polyglot"))

        primary_lang = languages[0] if languages else "Polyglot"

        # Inspect Git Details
        git_remote = None
        git_branch = None
        git_commit = None
        try:
            r = subprocess.run(
                ["git", "-C", str(p), "config", "--get", "remote.origin.url"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if r.returncode == 0 and r.stdout.strip():
                git_remote = _safe_git_remote(r.stdout.strip())

            b = subprocess.run(
                ["git", "-C", str(p), "rev-parse", "--abbrev-ref", "HEAD"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if b.returncode == 0 and b.stdout.strip():
                git_branch = b.stdout.strip()

            c = subprocess.run(
                ["git", "-C", str(p), "rev-parse", "--short", "HEAD"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if c.returncode == 0 and c.stdout.strip():
                git_commit = c.stdout.strip()
        except Exception:
            pass

        # Inspect Directory Components
        for candidate in ("src", "apps", "packages", "crates", "tests", "docs", "frontend", "backend", "api"):
            component_dir = p / candidate
            if component_dir.is_dir() and not component_dir.is_symlink():
                key_components.append(candidate)

        # Inspect README for synopsis
        readme_synopsis = ""
        for rd in ("README.md", "readme.md", "README"):
            readme_file = _workspace_file(p, rd)
            if readme_file:
                try:
                    raw = readme_file.read_text(encoding="utf-8", errors="ignore").strip()
                    lines = [ln.strip("# *") for ln in raw.splitlines() if ln.strip() and not ln.startswith("[!")]
                    if lines:
                        synopsis = " — " + " ".join(lines[:2])[:220]
                        readme_synopsis = PromptSanitizer.scrub_secrets(synopsis)
                    break
                except Exception:
                    pass

        summary = (
            f"Existing {primary_lang} codebase detected at {p.name}{readme_synopsis}."
        )

        suggested = [
            f"Audit and verify {primary_lang} build, test, and type-safety boundaries",
            "Decompose core domain features across specialized workforce swarm",
            "Establish continuous automated test and quality sentinel review gates",
        ]

        return WorkspaceInspectionResult(
            target_path=str(p),
            is_existing_codebase=True,
            project_name=p.name,
            primary_language=primary_lang,
            detected_frameworks=sorted(list(set(detected_frameworks))),
            git_remote=git_remote,
            git_branch=git_branch,
            git_commit=git_commit,
            summary=summary,
            key_components=key_components,
            suggested_initiatives=suggested,
        )
