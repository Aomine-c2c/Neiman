"""
Unit and integration tests for NEIMAN OS Sandboxed Code Execution Runtime.

Validates:
1. Safe execution of Python code within kernel-isolated bubblewrap container
2. Safe execution of Node.js code
3. Safe execution of Bash scripts and commands
4. AST pre-execution safety: rejection of forbidden Python calls (eval, exec, dangerous imports)
5. AST/token safety: rejection of forbidden Node.js calls (child_process)
6. REST API: /runtime/execute, /runtime/executions, /runtime/metrics
7. Telemetry recording in runtime_manager
"""

import uuid
import pytest
from httpx import AsyncClient

from nexora.core.sandbox import (
    CodeSafetyInspector,
    ExecutionSandbox,
    SandboxExecutionSpec,
    runtime_manager,
)

pytestmark = pytest.mark.asyncio


class TestSandboxExecutionEngine:
    def test_inspect_python_code_safe(self):
        code = "total = sum([x * 2 for x in range(10)])\nprint(f'Total: {total}')"
        safe, err = CodeSafetyInspector.inspect_python_code(code)
        assert safe is True
        assert err is None

    def test_inspect_python_code_forbidden_eval(self):
        code = "result = eval('1 + 1')"
        safe, err = CodeSafetyInspector.inspect_python_code(code)
        assert safe is False
        assert "eval" in err

    def test_inspect_python_code_forbidden_exec(self):
        code = "exec('import os')"
        safe, err = CodeSafetyInspector.inspect_python_code(code)
        assert safe is False
        assert "exec" in err

    def test_inspect_python_code_forbidden_import(self):
        code = "import pty\npty.spawn('/bin/sh')"
        safe, err = CodeSafetyInspector.inspect_python_code(code)
        assert safe is False
        assert "pty" in err

    def test_inspect_node_code_safe(self):
        code = "const nums = [1, 2, 3]; console.log(nums.reduce((a, b) => a + b, 0));"
        safe, err = CodeSafetyInspector.inspect_node_code(code)
        assert safe is True
        assert err is None

    def test_inspect_node_code_forbidden_child_process(self):
        code = "const cp = require('child_process'); cp.execSync('ls');"
        safe, err = CodeSafetyInspector.inspect_node_code(code)
        assert safe is False
        assert "child_process" in err

    def test_execute_python_in_sandbox(self):
        company_id = uuid.uuid4()
        sandbox = ExecutionSandbox(company_id=company_id)
        spec = SandboxExecutionSpec(
            code="result = 40 + 2\nprint(f'COMPUTED: {result}')",
            language="python",
            timeout_seconds=10.0,
        )
        res = sandbox.execute(spec)
        assert res.status == "SUCCESS"
        assert res.exit_code == 0
        assert "COMPUTED: 42" in res.stdout
        assert res.duration_ms > 0
        assert res.security_checks_passed is True

    def test_execute_python_forbidden_ast_blocked(self):
        company_id = uuid.uuid4()
        sandbox = ExecutionSandbox(company_id=company_id)
        spec = SandboxExecutionSpec(
            code="eval('2 + 2')",
            language="python",
            timeout_seconds=5.0,
        )
        res = sandbox.execute(spec)
        assert res.status == "FORBIDDEN"
        assert res.security_checks_passed is False
        assert "eval" in res.violation_reason

    def test_execute_node_in_sandbox(self):
        company_id = uuid.uuid4()
        sandbox = ExecutionSandbox(company_id=company_id)
        spec = SandboxExecutionSpec(
            code="const greeting = 'NEIMAN-NODE'; console.log(`RUNTIME: ${greeting}`);",
            language="node",
            timeout_seconds=10.0,
        )
        res = sandbox.execute(spec)
        assert res.status == "SUCCESS"
        assert res.exit_code == 0
        assert "RUNTIME: NEIMAN-NODE" in res.stdout

    def test_execute_bash_command_in_sandbox(self):
        company_id = uuid.uuid4()
        sandbox = ExecutionSandbox(company_id=company_id)
        spec = SandboxExecutionSpec(
            command="echo 'SANDBOX_BASH_EXEC'",
            language="bash",
            timeout_seconds=5.0,
        )
        res = sandbox.execute(spec)
        assert res.status == "SUCCESS"
        assert res.exit_code == 0
        assert "SANDBOX_BASH_EXEC" in res.stdout


class TestRuntimeApiRouter:
    async def test_runtime_execute_api(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]
        resp = await client.post(
            f"/api/v1/companies/{company_id}/runtime/execute",
            json={
                "code": "print('API_RUNTIME_TEST_SUCCESS')",
                "language": "python",
                "timeout_seconds": 10.0,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SUCCESS"
        assert "API_RUNTIME_TEST_SUCCESS" in data["stdout"]
        assert data["duration_ms"] > 0

    async def test_runtime_executions_list_and_metrics_api(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # Run an execution first
        await client.post(
            f"/api/v1/companies/{company_id}/runtime/execute",
            json={
                "code": "print('METRICS_TEST')",
                "language": "python",
                "timeout_seconds": 5.0,
            },
            headers=auth_headers,
        )

        # Check list executions
        list_resp = await client.get(
            f"/api/v1/companies/{company_id}/runtime/executions",
            headers=auth_headers,
        )
        assert list_resp.status_code == 200
        executions = list_resp.json()
        assert len(executions) >= 1

        # Check metrics endpoint
        metrics_resp = await client.get(
            f"/api/v1/companies/{company_id}/runtime/metrics",
            headers=auth_headers,
        )
        assert metrics_resp.status_code == 200
        metrics = metrics_resp.json()
        assert metrics["total_executions"] >= 1
        assert "python" in metrics["supported_languages"]
        assert metrics["sandbox_backend"] == "bubblewrap_kernel_isolated"

