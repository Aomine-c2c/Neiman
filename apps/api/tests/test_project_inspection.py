"""Unit and integration tests for WorkspaceInspector and projects inspect endpoint."""

import pytest
from httpx import AsyncClient

from nexora.domains.projects.inspector import WorkspaceInspector


def test_workspace_inspector_empty_dir(tmp_path, monkeypatch):
    """Empty directory should be recognized as non-codebase with minimal initiatives."""
    monkeypatch.setenv("NEIMAN_WORKSPACE_ROOT", str(tmp_path))
    empty_dir = tmp_path / "empty_workspace"
    empty_dir.mkdir()

    res = WorkspaceInspector.inspect(str(empty_dir))
    assert res.is_existing_codebase is False
    assert res.primary_language == "Unspecified"
    assert res.target_path == str(empty_dir)
    assert len(res.suggested_initiatives) >= 2


def test_workspace_inspector_python_project(tmp_path, monkeypatch):
    """Detects Python projects with pyproject.toml and requirements.txt."""
    monkeypatch.setenv("NEIMAN_WORKSPACE_ROOT", str(tmp_path))
    py_dir = tmp_path / "my_python_app"
    py_dir.mkdir()
    (py_dir / "pyproject.toml").write_text("[project]\nname = 'my_python_app'\nversion = '0.1.0'\n")
    (py_dir / "requirements.txt").write_text("fastapi>=0.100.0\npytest>=8.0.0\n")
    (py_dir / "README.md").write_text("# My Python App\nA scalable backend service.\n")

    res = WorkspaceInspector.inspect(str(py_dir))
    assert res.is_existing_codebase is True
    assert res.primary_language == "Python"
    assert "fastapi" in res.detected_frameworks
    assert "pytest" in res.detected_frameworks
    assert res.project_name == "my_python_app"
    assert "A scalable backend service" in res.summary


def test_workspace_inspector_rust_project(tmp_path, monkeypatch):
    """Detects Rust Cargo project with Cargo.toml."""
    monkeypatch.setenv("NEIMAN_WORKSPACE_ROOT", str(tmp_path))
    rust_dir = tmp_path / "rust_node"
    rust_dir.mkdir()
    (rust_dir / "Cargo.toml").write_text('[package]\nname = "rust_node"\nversion = "0.1.0"\n[dependencies]\ntokio = "1"\nratatui = "0.29"\n')

    res = WorkspaceInspector.inspect(str(rust_dir))
    assert res.is_existing_codebase is True
    assert res.primary_language == "Rust"
    assert "tokio" in res.detected_frameworks
    assert "ratatui" in res.detected_frameworks
    assert res.project_name == "rust_node"


def test_workspace_inspector_node_project(tmp_path, monkeypatch):
    """Detects TypeScript/Node project with package.json."""
    monkeypatch.setenv("NEIMAN_WORKSPACE_ROOT", str(tmp_path))
    node_dir = tmp_path / "web_client"
    node_dir.mkdir()
    (node_dir / "package.json").write_text('{"name": "web_client", "dependencies": {"next": "15.0", "react": "19.0"}}')
    (node_dir / "tsconfig.json").write_text('{"compilerOptions": {}}')

    res = WorkspaceInspector.inspect(str(node_dir))
    assert res.is_existing_codebase is True
    assert res.primary_language == "TypeScript/JavaScript"
    assert "next" in res.detected_frameworks
    assert "react" in res.detected_frameworks


@pytest.mark.asyncio
async def test_project_inspect_endpoint(client: AsyncClient, auth_headers: dict, company_via_api: dict, tmp_path, monkeypatch):
    """Verify POST /companies/{company_id}/projects/inspect returns WorkspaceInspectionResult."""
    monkeypatch.setenv("NEIMAN_WORKSPACE_ROOT", str(tmp_path))
    comp_id = company_via_api["id"]
    test_dir = tmp_path / "inspect_target"
    test_dir.mkdir()
    (test_dir / "go.mod").write_text("module github.com/org/service\ngo 1.22\n")

    res = await client.post(
        f"/api/v1/companies/{comp_id}/projects/inspect",
        json={"path": str(test_dir)},
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["primary_language"] == "Go"
    assert data["is_existing_codebase"] is True
    assert data["project_name"] == "inspect_target"
