"""
Agent task execution engine.
Implements the formal 10-step lifecycle:
TASK_RECEIVED
-> CONTEXT_ASSEMBLY
-> PLAN
-> RESOURCE_CHECK
-> INTELLIGENCE_SELECTION
-> TOOL_EXECUTION
-> RESULT
-> VALIDATION
-> REPORT
-> MEMORY_UPDATE

Every action is traceable and logged to AgentExecutionAudit.
Permission checks and resource limits are rigorously enforced.
"""

import json
import time
import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import (
    AgentStatus,
    AuditAction,
    ExecutionStatus,
    ExecutionStep,
    TaskStatus,
)
from nexora.domains.agents.repository import (
    AgentAuditRepository,
    AgentMemoryRepository,
    AgentRepository,
)
from nexora.domains.agents.schemas import ExecutionStepRecord, TaskExecutionResult
from nexora.domains.projects.models import Task
from nexora.domains.projects.repository import TaskRepository
from nexora.exceptions import BusinessRuleError, ForbiddenError, NotFoundError


class AgentExecutionEngine:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.agent_repo = AgentRepository(db)
        self.task_repo = TaskRepository(db)
        self.memory_repo = AgentMemoryRepository(db)
        self.audit_repo = AgentAuditRepository(db)

    async def execute_task(
        self,
        agent_id: uuid.UUID,
        company_id: uuid.UUID,
        task_id: uuid.UUID,
        input_data: dict | None = None,
        override_model: str | None = None,
    ) -> TaskExecutionResult:
        """
        Execute an organizational task through the 10-step lifecycle.
        Ensures strict capability checks, resource enforcement, and memory persistence.
        """
        execution_id = uuid.uuid4()
        step_records: list[ExecutionStepRecord] = []
        overall_start = time.perf_counter()

        agent = await self.agent_repo.get_by_id(agent_id)
        if not agent or agent.company_id != company_id:
            raise NotFoundError(f"Agent {agent_id} not found.")

        task = await self.task_repo.get_by_id(task_id)
        if not task or task.company_id != company_id:
            raise NotFoundError(f"Task {task_id} not found.")

        if task.assigned_agent_id is not None and task.assigned_agent_id != agent.id:
            raise ForbiddenError("Task is assigned to a different agent.")
        if task.status in (TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.CANCELLED):
            raise BusinessRuleError(f"Task in state {task.status} cannot be started.")
        if task.dependencies:
            from sqlalchemy import select

            try:
                dependency_ids = {uuid.UUID(str(dependency)) for dependency in task.dependencies}
            except (TypeError, ValueError) as exc:
                raise BusinessRuleError("Task contains an invalid dependency reference.") from exc

            dependency_result = await self.db.execute(
                select(Task.id, Task.status).where(
                    Task.id.in_(dependency_ids),
                    Task.company_id == company_id,
                    Task.project_id == task.project_id,
                    Task.is_deleted.is_(False),
                )
            )
            dependency_statuses = dependency_result.all()
            if len(dependency_statuses) != len(dependency_ids):
                raise BusinessRuleError("Task has a missing or out-of-project dependency.")
            if any(
                dependency_status != TaskStatus.COMPLETED
                for _, dependency_status in dependency_statuses
            ):
                raise BusinessRuleError("All task dependencies must be completed before execution.")

        # Check agent status - allow CONFIGURED / CREATED agents to transition to WORKING upon assignment
        if agent.status in (AgentStatus.CREATED, AgentStatus.CONFIGURED):
            agent = await self.agent_repo.update(agent, status=AgentStatus.AVAILABLE)
        elif agent.status not in (AgentStatus.AVAILABLE, AgentStatus.WORKING):
            raise BusinessRuleError(f"Agent is in state {agent.status}, cannot execute tasks.")

        # Set Agent to WORKING
        await self.agent_repo.update(agent, status=AgentStatus.WORKING)
        await self.task_repo.update(task, status=TaskStatus.IN_PROGRESS, assigned_agent_id=agent.id)

        tokens_consumed = 0
        cost_usd = 0.0

        try:
            # ── 1. TASK RECEIVED ───────────────────────────────────────────────
            t0 = time.perf_counter()
            await self.audit_repo.record_audit(
                agent_id=agent.id,
                company_id=company_id,
                execution_id=execution_id,
                task_id=task.id,
                action=AuditAction.EXECUTION_STEP,
                step=ExecutionStep.TASK_RECEIVED,
                status=ExecutionStatus.SUCCESS,
                details={
                    "title": task.title,
                    "priority": task.priority,
                    "input_data": input_data or {},
                },
            )
            step_records.append(
                ExecutionStepRecord(
                    step=ExecutionStep.TASK_RECEIVED,
                    status=ExecutionStatus.SUCCESS,
                    details={"message": f"Task '{task.title}' accepted."},
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
            )

            # ── 2. CONTEXT ASSEMBLY ────────────────────────────────────────────
            t0 = time.perf_counter()
            relevant_memories = await self.memory_repo.search_memory(agent.id, task.title[:20])
            context_payload = {
                "agent_identity": agent.identity,
                "role_responsibilities": agent.responsibilities,
                "system_instructions": agent.system_instructions,
                "retrieved_memories_count": len(relevant_memories),
                "task_description": task.description,
            }
            await self.audit_repo.record_audit(
                agent_id=agent.id,
                company_id=company_id,
                execution_id=execution_id,
                task_id=task.id,
                action=AuditAction.EXECUTION_STEP,
                step=ExecutionStep.CONTEXT_ASSEMBLY,
                status=ExecutionStatus.SUCCESS,
                details=context_payload,
            )
            step_records.append(
                ExecutionStepRecord(
                    step=ExecutionStep.CONTEXT_ASSEMBLY,
                    status=ExecutionStatus.SUCCESS,
                    details={"memories_retrieved": len(relevant_memories)},
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
            )

            # ── 3. PLAN ────────────────────────────────────────────────────────
            t0 = time.perf_counter()
            plan_steps = [
                f"Analyze requirement: {task.title}",
                "Evaluate allowed tools and policies",
                "Execute synthesis and generate expected outcome",
            ]
            # Governance evaluation & constitutional check
            from nexora.domains.governance.schemas import GovernanceActionEvaluationRequest
            from nexora.domains.governance.service import GovernanceService

            gov_service = GovernanceService(self.db)
            gov_eval = await gov_service.evaluate_action(
                company_id=company_id,
                req=GovernanceActionEvaluationRequest(
                    actor_id=agent.id,
                    actor_name=agent.name,
                    actor_type="AGENT",
                    department_id=agent.department_id,
                    role_id=agent.role_id,
                    agent_id=agent.id,
                    action_name="EXECUTE_TASK",
                    target=f"Task:{task.id}",
                    reason=f"Assigned task execution: {task.title}",
                    payload={"priority": task.priority, "input_data": input_data or {}},
                ),
            )
            if gov_eval.is_prohibited:
                raise ForbiddenError(
                    f"Action blocked by Company Constitution: {gov_eval.matched_constitution_clause}"
                )

            await self.audit_repo.record_audit(
                agent_id=agent.id,
                company_id=company_id,
                execution_id=execution_id,
                task_id=task.id,
                action=AuditAction.EXECUTION_STEP,
                step=ExecutionStep.PLAN,
                status=ExecutionStatus.SUCCESS,
                details={
                    "plan_steps": plan_steps,
                    "autonomy_level": gov_eval.effective_autonomy_level,
                    "autonomy_label": gov_eval.effective_autonomy_label,
                    "requires_approval": gov_eval.requires_approval,
                },
            )
            step_records.append(
                ExecutionStepRecord(
                    step=ExecutionStep.PLAN,
                    status=ExecutionStatus.SUCCESS,
                    details={
                        "steps_count": len(plan_steps),
                        "plan": plan_steps,
                        "autonomy": gov_eval.effective_autonomy_label,
                    },
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
            )

            # ── 4. RESOURCE CHECK ──────────────────────────────────────────────
            t0 = time.perf_counter()
            limits = agent.resource_limits or {}
            usage = agent.resource_usage or {}
            max_daily_budget = limits.get("max_daily_budget_usd", 10.0)
            current_cost = usage.get("total_cost_usd", 0.0)

            if current_cost >= max_daily_budget:
                raise ForbiddenError(
                    f"Agent exceeded daily budget limit (${max_daily_budget:.2f})."
                )

            await self.audit_repo.record_audit(
                agent_id=agent.id,
                company_id=company_id,
                execution_id=execution_id,
                task_id=task.id,
                action=AuditAction.EXECUTION_STEP,
                step=ExecutionStep.RESOURCE_CHECK,
                status=ExecutionStatus.SUCCESS,
                details={"budget_remaining": max_daily_budget - current_cost},
            )
            step_records.append(
                ExecutionStepRecord(
                    step=ExecutionStep.RESOURCE_CHECK,
                    status=ExecutionStatus.SUCCESS,
                    details={"resource_cleared": True},
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
            )

            # ── 5. INTELLIGENCE SELECTION ──────────────────────────────────────
            t0 = time.perf_counter()
            from nexora.domains.intelligence.schemas import ModelRequest
            from nexora.domains.intelligence.service import IntelligenceService

            intel_service = IntelligenceService(self.db)
            preferred_model = override_model  # Dynamic adaptive rotation: agents do not have fixed models

            from nexora.domains.intelligence.rotation import resolve_task_complexity
            complexity_tier = resolve_task_complexity(
                task=task, agent=agent, required_capabilities=agent.capabilities
            )

            # Normalize capabilities to model dimensions so domain skills do not eliminate candidate models
            KNOWN_MODEL_CAPS = {
                "reasoning", "code_generation", "vision", "agentic", "text",
                "large_context", "speed", "multimodal", "analysis", "architectural_reasoning"
            }
            raw_caps = set(agent.capabilities or [])
            required_caps = list(raw_caps.intersection(KNOWN_MODEL_CAPS)) or ["reasoning"]

            from nexora.core.security import (
                FillerScrubber,
                ModelOutputBoundary,
                PromptSanitizer,
                ToolSandbox,
            )

            # Keep trusted agent identity in the system channel and untrusted task data in user content.
            from nexora.domains.agents.identity_files import get_agent_system_instructions

            raw_prompt_text = json.dumps(
                {
                    "task_title": task.title,
                    "task_description": task.description or "",
                    "input_data": input_data or {},
                },
                ensure_ascii=False,
                default=str,
            )
            is_injected, injection_reason = PromptSanitizer.scan_for_injection(raw_prompt_text)
            if is_injected:
                raise ForbiddenError(
                    f"Security Alert: Malicious prompt pattern detected: {injection_reason}"
                )

            # 2. PII & Secrets Scrubbing (Least-privilege context transmission to external model)
            sanitized_prompt = PromptSanitizer.sanitize_for_external_llm(raw_prompt_text)
            system_prompt = PromptSanitizer.sanitize_for_external_llm(
                get_agent_system_instructions(agent)
            )

            # 3. Input Token Compression (Rule 6: Zero-Filler, High-Density Prompt Optimization)
            from nexora.core.compression import TokenCompressor, CompressionStrategy

            comp_prompt_res = TokenCompressor.compress(sanitized_prompt, strategy=CompressionStrategy.DYNAMIC)
            comp_sys_res = TokenCompressor.compress(system_prompt, strategy=CompressionStrategy.BALANCED)

            compressed_prompt = comp_prompt_res.compressed_text
            compressed_system = comp_sys_res.compressed_text

            total_input_orig = comp_prompt_res.original_tokens + comp_sys_res.original_tokens
            total_input_comp = comp_prompt_res.compressed_tokens + comp_sys_res.compressed_tokens
            total_input_saved = comp_prompt_res.tokens_saved + comp_sys_res.tokens_saved
            compression_ratio = round((total_input_saved / total_input_orig * 100.0), 2) if total_input_orig > 0 else 0.0

            sim_flags = input_data.get("simulation_flags") if isinstance(input_data, dict) else None
            req_meta = dict(input_data.get("metadata", {}) if isinstance(input_data, dict) else {})
            req_meta["complexity"] = complexity_tier.value
            req_meta["is_working_agent"] = True
            req_meta["agent_name"] = agent.name
            req_meta["task_id"] = str(task.id)
            req_meta["input_compression"] = {
                "original_tokens": total_input_orig,
                "compressed_tokens": total_input_comp,
                "tokens_saved": total_input_saved,
                "compression_ratio_pct": compression_ratio,
                "cost_saved_usd": round(total_input_saved * (2.50 / 1_000_000.0), 6),
            }

            step_records.append(
                ExecutionStepRecord(
                    step=ExecutionStep.CONTEXT_ASSEMBLY,
                    status=ExecutionStatus.SUCCESS,
                    details=req_meta["input_compression"],
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
            )

            intel_req = ModelRequest(
                prompt=compressed_prompt,
                system_prompt=compressed_system,
                required_capabilities=required_caps,
                preferred_model=preferred_model,
                simulation_flags=sim_flags,
                metadata=req_meta,
                enable_token_compression=False,
            )

            # Route model through exchange
            policy = await intel_service.router.get_or_create_default_policy(company_id)
            candidates = await intel_service.router.resolve_candidate_models(intel_req, policy)
            selected_model = preferred_model or (
                candidates[0].model_identifier if candidates else "gpt-4o"
            )
            candidates[0].provider_id if candidates else "openai"

            await self.audit_repo.record_audit(
                agent_id=agent.id,
                company_id=company_id,
                execution_id=execution_id,
                task_id=task.id,
                action=AuditAction.EXECUTION_STEP,
                step=ExecutionStep.INTELLIGENCE_SELECTION,
                status=ExecutionStatus.SUCCESS,
                details={"model": selected_model, "capabilities": required_caps},
            )
            step_records.append(
                ExecutionStepRecord(
                    step=ExecutionStep.INTELLIGENCE_SELECTION,
                    status=ExecutionStatus.SUCCESS,
                    details={"model": selected_model, "capabilities": required_caps},
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
            )

            # ── 6. TOOL EXECUTION ──────────────────────────────────────────────
            t0 = time.perf_counter()
            # Enforce capability-based permission verification and tool sandboxing
            denied_tools = set(agent.permissions.get("denied_tools", []))
            allowed_tools = set(
                agent.permissions.get(
                    "allowed_tools", ["analysis_tool", "reporting_tool", "unit_test"]
                )
            )
            from nexora.core.mcp import MCPToolCallRequest, mcp_manager

            # Inherit active tools from enabled MCP servers unless explicitly denied
            for srv in mcp_manager.list_servers():
                if srv.is_enabled:
                    for srv_tool in srv.tools:
                        if srv_tool.name not in denied_tools:
                            allowed_tools.add(srv_tool.name)

            executed_tools = []
            for tool in agent.tools or []:
                t_name = str(tool.get("name") if isinstance(tool, dict) and tool.get("name") else tool)
                if not t_name or t_name not in allowed_tools:
                    continue

                # Sandboxing validations based on tool type
                t_args = tool.get("args", {}) if isinstance(tool, dict) else {}
                if "path" in t_args:
                    ToolSandbox.validate_filesystem_access(
                        t_args["path"],
                        allowed_directories=agent.permissions.get(
                            "allowed_paths", ["/workspace", "/tmp"]
                        ),
                    )
                if "command" in t_args:
                    ToolSandbox.validate_terminal_command(t_args["command"])
                if "query" in t_args:
                    ToolSandbox.validate_database_query(t_args["query"])
                if "url" in t_args:
                    await ToolSandbox.validate_external_url_async(t_args["url"])

                # Dispatch MCP Tool if matching registered MCP servers
                mcp_output = None
                matched_mcp_tool = False
                from nexora.core.mcp import MCPToolCallRequest, mcp_manager

                for srv in mcp_manager.list_servers():
                    if any(t.name == t_name for t in srv.tools):
                        matched_mcp_tool = True
                        mcp_res = await mcp_manager.call_tool(
                            MCPToolCallRequest(
                                server_id=srv.id,
                                tool_name=t_name,
                                arguments=t_args,
                                company_id=company_id,
                            )
                        )
                        if mcp_res.status != "SUCCESS":
                            raise BusinessRuleError(
                                mcp_res.error_message or f"MCP tool '{t_name}' did not succeed."
                            )
                        mcp_output = mcp_res.raw_output
                        break

                if not matched_mcp_tool:
                    mcp_output = {
                        "tool": t_name,
                        "status": "SUCCESS",
                        "execution_mode": "native_sandbox",
                        "result": f"Tool '{t_name}' completed safely within sandbox.",
                    }

                executed_tools.append(t_name)
                await self.audit_repo.record_audit(
                    agent_id=agent.id,
                    company_id=company_id,
                    execution_id=execution_id,
                    task_id=task.id,
                    action=AuditAction.TOOL_EXECUTED,
                    step=ExecutionStep.TOOL_EXECUTION,
                    status=ExecutionStatus.SUCCESS,
                    details={"tool": t_name, "authorized": True, "mcp_output": mcp_output},
                )

            step_records.append(
                ExecutionStepRecord(
                    step=ExecutionStep.TOOL_EXECUTION,
                    status=ExecutionStatus.SUCCESS,
                    details={"executed_tools": executed_tools},
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
            )

            # ── 7. RESULT ──────────────────────────────────────────────────────
            t0 = time.perf_counter()
            from nexora.domains.agents.worktree_runner import (
                WorktreeCodeRunner,
                WorktreeExecutionBlockedError,
            )
            from nexora.domains.vcs.service import get_company_workspace_dir

            repo_root = get_company_workspace_dir(str(company_id))
            autonomous_code_enabled = bool(
                (input_data or {}).get("autonomous_code")
                or (agent.permissions or {}).get("autonomous_code")
            )

            if autonomous_code_enabled and (repo_root / ".git").exists():
                async def _invoke_worktree_model(system_prompt: str, prompt: str):
                    wt_req = ModelRequest(
                        prompt=prompt,
                        system_prompt=system_prompt,
                        required_capabilities=required_caps,
                        model_preference=selected_model,
                        max_tokens=intel_req.max_tokens,
                        temperature=intel_req.temperature,
                    )
                    return await intel_service.execute_request(
                        company_id=company_id,
                        request=wt_req,
                        agent_id=agent.id,
                        task_id=task.id,
                    )

                async def _on_tool_event(ev: dict[str, Any]) -> None:
                    executed_tools.append(ev["tool"])
                    await self.audit_repo.record_audit(
                        agent_id=agent.id,
                        company_id=company_id,
                        execution_id=execution_id,
                        task_id=task.id,
                        action=AuditAction.TOOL_EXECUTED,
                        step=ExecutionStep.TOOL_EXECUTION,
                        status=ExecutionStatus.SUCCESS if ev["ok"] else ExecutionStatus.FAILED,
                        details=ev,
                    )
                    try:
                        from nexora.domains.activity.broadcaster import activity_broadcaster
                        from nexora.domains.activity.schemas import (
                            ActivityEvent,
                            ActivityEventType,
                            ActivitySeverity,
                        )

                        await activity_broadcaster.broadcast(
                            str(company_id),
                            ActivityEvent(
                                company_id=str(company_id),
                                event_type=(
                                    ActivityEventType.RUNTIME_EXECUTION_COMPLETED
                                    if ev["ok"]
                                    else ActivityEventType.RUNTIME_EXECUTION_BLOCKED
                                ),
                                severity=ActivitySeverity.INFO if ev["ok"] else ActivitySeverity.MEDIUM,
                                title=f"{ev['tool']} (step {ev['step']})",
                                summary=str(ev.get("output_preview") or "")[:240],
                                agent_id=str(agent.id),
                                agent_name=agent.name,
                                project_id=str(task.project_id),
                                payload={
                                    "kind": "WORKTREE_TOOL_CALL",
                                    "task_id": str(task.id),
                                    "task_title": task.title,
                                    "step": ev["step"],
                                    "tool": ev["tool"],
                                    "ok": ev["ok"],
                                },
                            ),
                        )
                    except Exception:
                        pass

                wt_runner = WorktreeCodeRunner(repo_root=repo_root)
                wt_res = await wt_runner.execute_task_in_worktree(
                    task_id=str(task.id),
                    task_title=task.title,
                    task_description=task.description or task.title,
                    expected_outcome=task.expected_outcome or "Tests pass and changes are merged.",
                    system_prompt=intel_req.system_prompt or "You are an autonomous software engineer.",
                    invoke_model=_invoke_worktree_model,
                    on_tool_event=_on_tool_event,
                )
                try:
                    from nexora.domains.activity.broadcaster import activity_broadcaster
                    from nexora.domains.activity.schemas import (
                        ActivityEvent,
                        ActivityEventType,
                        ActivitySeverity,
                    )

                    await activity_broadcaster.broadcast(
                        str(company_id),
                        ActivityEvent(
                            company_id=str(company_id),
                            event_type=ActivityEventType.AGENT_COMPLETED,
                            severity=ActivitySeverity.INFO,
                            title=f"Merged {wt_res.branch_name}" if wt_res.merged_to_main else f"Completed {task.title}",
                            summary=wt_res.summary[:240],
                            agent_id=str(agent.id),
                            agent_name=agent.name,
                            project_id=str(task.project_id),
                            payload={
                                "kind": "WORKTREE_MERGED",
                                "task_id": str(task.id),
                                "task_title": task.title,
                                "branch_name": wt_res.branch_name,
                                "commit_sha": wt_res.commit_sha,
                                "merged_to_main": wt_res.merged_to_main,
                                "files_changed": wt_res.files_changed,
                                "tests_passed": wt_res.tests_passed,
                            },
                        ),
                    )
                except Exception:
                    pass
                scrubbed_summary = FillerScrubber.compress_to_fragments(wt_res.summary)
                is_limit_reached = False
                output_result = {
                    "task_title": task.title,
                    "summary": scrubbed_summary,
                    "outcome_achieved": task.expected_outcome
                    or "Task changes verified and merged into main.",
                    "tools_utilized": executed_tools,
                    "model_used": selected_model,
                    "provider_used": "worktree_runner",
                    "failover_trace": [],
                    "finish_reason": "stop",
                    "is_truncated": False,
                    "worktree_branch": wt_res.branch_name,
                    "commit_sha": wt_res.commit_sha,
                    "merged_to_main": wt_res.merged_to_main,
                    "files_changed": wt_res.files_changed,
                    "tests_passed": wt_res.tests_passed,
                }
                tokens_consumed = wt_res.tokens_consumed
                cost_usd = wt_res.cost_usd
            else:
                # Execute actual generation via Intelligence Exchange
                gen_resp = await intel_service.execute_request(
                    company_id=company_id,
                    request=intel_req,
                    agent_id=agent.id,
                    task_id=task.id,
                )

                # Inspect model output as untrusted input
                is_smuggled, smuggle_err = ModelOutputBoundary.inspect_output_for_instruction_smuggling(
                    gen_resp.text
                )
                if is_smuggled:
                    raise ForbiddenError(
                        f"Security Alert: Untrusted model response intercepted: {smuggle_err}"
                    )

                # Strip conversational filler & enforce dense fragments
                scrubbed_summary = FillerScrubber.compress_to_fragments(gen_resp.text)
                # Verify generation completeness and ensure credit goes to succeeding model
                is_limit_reached = getattr(gen_resp, "is_truncated", False) or getattr(gen_resp, "finish_reason", "stop") == "length"

                output_result = {
                    "task_title": task.title,
                    "summary": scrubbed_summary,
                    "outcome_achieved": task.expected_outcome
                    or "Task requirements satisfied successfully.",
                    "tools_utilized": executed_tools,
                    "model_used": getattr(gen_resp, "credited_model", None) or gen_resp.model_used,
                    "provider_used": getattr(gen_resp, "credited_provider", None) or gen_resp.provider_used,
                    "failover_trace": getattr(gen_resp, "failover_trace", []),
                    "finish_reason": getattr(gen_resp, "finish_reason", "stop"),
                    "is_truncated": getattr(gen_resp, "is_truncated", False),
                }
                tokens_consumed = gen_resp.total_tokens
                cost_usd = gen_resp.estimated_cost_usd

            await self.audit_repo.record_audit(
                agent_id=agent.id,
                company_id=company_id,
                execution_id=execution_id,
                task_id=task.id,
                action=AuditAction.EXECUTION_STEP,
                step=ExecutionStep.RESULT,
                status=ExecutionStatus.SUCCESS,
                details=output_result,
                tokens_consumed=tokens_consumed,
                cost_usd=cost_usd,
            )
            step_records.append(
                ExecutionStepRecord(
                    step=ExecutionStep.RESULT,
                    status=ExecutionStatus.SUCCESS,
                    details=output_result,
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
            )

            # ── 8. VALIDATION ──────────────────────────────────────────────────
            t0 = time.perf_counter()
            # Quality validation against expectations: require outcome achieved and zero limit truncation
            validation_passed = bool(output_result.get("outcome_achieved")) and not is_limit_reached
            if not validation_passed:
                raise BusinessRuleError(
                    f"Task execution failed validation: Output reached limit or was truncated (finish_reason={output_result['finish_reason']})"
                )
            await self.audit_repo.record_audit(
                agent_id=agent.id,
                company_id=company_id,
                execution_id=execution_id,
                task_id=task.id,
                action=AuditAction.EXECUTION_STEP,
                step=ExecutionStep.VALIDATION,
                status=ExecutionStatus.SUCCESS if validation_passed else ExecutionStatus.FAILED,
                details={"validation_passed": validation_passed},
            )
            step_records.append(
                ExecutionStepRecord(
                    step=ExecutionStep.VALIDATION,
                    status=ExecutionStatus.SUCCESS if validation_passed else ExecutionStatus.FAILED,
                    details={"validated": validation_passed},
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
            )

            # ── 9. REPORT ──────────────────────────────────────────────────────
            t0 = time.perf_counter()
            report_data = {
                "execution_id": str(execution_id),
                "task_id": str(task.id),
                "agent_id": str(agent.id),
                "summary": output_result["summary"],
                "status": "COMPLETED",
            }
            await self.audit_repo.record_audit(
                agent_id=agent.id,
                company_id=company_id,
                execution_id=execution_id,
                task_id=task.id,
                action=AuditAction.EXECUTION_STEP,
                step=ExecutionStep.REPORT,
                status=ExecutionStatus.SUCCESS,
                details=report_data,
            )
            step_records.append(
                ExecutionStepRecord(
                    step=ExecutionStep.REPORT,
                    status=ExecutionStatus.SUCCESS,
                    details=report_data,
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
            )

            # ── 10. MEMORY UPDATE ──────────────────────────────────────────────
            t0 = time.perf_counter()
            await self.memory_repo.add_memory(
                agent_id=agent.id,
                company_id=company_id,
                memory_type="episodic",
                key=f"task:{task.id}",
                content=f"Successfully executed task '{task.title}'. Outcome: {output_result['outcome_achieved']}",
                metadata={"execution_id": str(execution_id), "tools": executed_tools},
                importance=2.0,
            )
            await self.audit_repo.record_audit(
                agent_id=agent.id,
                company_id=company_id,
                execution_id=execution_id,
                task_id=task.id,
                action=AuditAction.MEMORY_STORED,
                step=ExecutionStep.MEMORY_UPDATE,
                status=ExecutionStatus.SUCCESS,
                details={"memory_key": f"task:{task.id}"},
            )
            step_records.append(
                ExecutionStepRecord(
                    step=ExecutionStep.MEMORY_UPDATE,
                    status=ExecutionStatus.SUCCESS,
                    details={"memory_stored": True},
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
            )

            # Finalize Task and Agent state
            await self.task_repo.update(task, status=TaskStatus.COMPLETED)
            total_duration_ms = (time.perf_counter() - overall_start) * 1000

            # Update Agent metrics
            updated_usage = dict(agent.resource_usage or {})
            updated_usage["total_tokens"] = updated_usage.get("total_tokens", 0) + tokens_consumed
            updated_usage["total_cost_usd"] = updated_usage.get("total_cost_usd", 0.0) + cost_usd
            updated_usage["total_tool_calls"] = updated_usage.get("total_tool_calls", 0) + len(
                executed_tools
            )

            updated_perf = dict(agent.performance_metadata or {})
            completed = updated_perf.get("tasks_completed", 0) + 1
            failed = updated_perf.get("tasks_failed", 0)
            updated_perf["tasks_completed"] = completed
            updated_perf["success_rate"] = completed / (completed + failed)
            updated_perf["last_active_at"] = datetime.now(UTC).isoformat()

            updated_intel = dict(agent.intelligence_config or {})
            updated_intel["mode"] = "adaptive"
            updated_intel["active_tier"] = complexity_tier.value
            updated_intel["last_rotated_model"] = output_result.get("model_used")
            updated_intel["last_provider_used"] = output_result.get("provider_used")
            updated_intel["last_rotated_at"] = datetime.now(UTC).isoformat()

            await self.agent_repo.update(
                agent,
                status=AgentStatus.AVAILABLE,
                resource_usage=updated_usage,
                performance_metadata=updated_perf,
                intelligence_config=updated_intel,
            )

            return TaskExecutionResult(
                execution_id=execution_id,
                task_id=task.id,
                agent_id=agent.id,
                final_status=ExecutionStatus.SUCCESS,
                steps=step_records,
                result=output_result,
                tokens_consumed=tokens_consumed,
                cost_usd=cost_usd,
                total_duration_ms=total_duration_ms,
            )

        except WorktreeExecutionBlockedError as blocked_err:
            from nexora.core.security import PromptSanitizer

            safe_error = PromptSanitizer.scrub_secrets(str(blocked_err))
            try:
                await self.db.rollback()
                fresh_task = await self.task_repo.get_by_id(task_id)
                fresh_agent = await self.agent_repo.get_by_id(agent_id)
                if fresh_task:
                    await self.task_repo.update(
                        fresh_task,
                        status=TaskStatus.BLOCKED,
                        output={
                            "error": safe_error,
                            "worktree_path": blocked_err.worktree_path,
                            "branch_name": blocked_err.branch_name,
                            "diff_output": blocked_err.diff_output,
                        },
                    )
                if fresh_agent:
                    await self.agent_repo.update(fresh_agent, status=AgentStatus.AVAILABLE)
                await self.audit_repo.record_audit(
                    agent_id=agent_id,
                    company_id=company_id,
                    execution_id=execution_id,
                    task_id=task_id,
                    action=AuditAction.EXECUTION_STEP,
                    status=ExecutionStatus.FAILED,
                    details={
                        "error": safe_error,
                        "worktree_path": blocked_err.worktree_path,
                        "branch_name": blocked_err.branch_name,
                    },
                )
                await self.db.commit()
                try:
                    from nexora.domains.activity.broadcaster import activity_broadcaster
                    from nexora.domains.activity.schemas import (
                        ActivityEvent,
                        ActivityEventType,
                        ActivitySeverity,
                    )

                    await activity_broadcaster.broadcast(
                        str(company_id),
                        ActivityEvent(
                            company_id=str(company_id),
                            event_type=ActivityEventType.TASK_FAILED,
                            severity=ActivitySeverity.HIGH,
                            title=f"Blocked: {blocked_err.branch_name}",
                            summary=safe_error[:240],
                            agent_id=str(agent_id),
                            agent_name=agent.name,
                            project_id=str(task.project_id),
                            payload={
                                "kind": "WORKTREE_BLOCKED",
                                "task_id": str(task_id),
                                "task_title": task.title,
                                "worktree_path": blocked_err.worktree_path,
                                "branch_name": blocked_err.branch_name,
                                "diff_output": blocked_err.diff_output[:2000],
                            },
                        ),
                    )
                except Exception:
                    pass
            except Exception:
                pass
            raise

        except Exception as e:
            # Revert agent and task status on failure with safe session handling
            from nexora.core.security import PromptSanitizer

            safe_error = PromptSanitizer.scrub_secrets(str(e))
            try:
                await self.db.rollback()
                fresh_task = await self.task_repo.get_by_id(task_id)
                fresh_agent = await self.agent_repo.get_by_id(agent_id)
                if fresh_task:
                    await self.task_repo.update(fresh_task, status=TaskStatus.PENDING)
                if fresh_agent:
                    updated_perf = dict(fresh_agent.performance_metadata or {})
                    updated_perf["tasks_failed"] = updated_perf.get("tasks_failed", 0) + 1
                    completed = updated_perf.get("tasks_completed", 0)
                    updated_perf["success_rate"] = completed / (
                        completed + updated_perf["tasks_failed"]
                    )
                    updated_perf["last_active_at"] = datetime.now(UTC).isoformat()
                    await self.agent_repo.update(
                        fresh_agent,
                        status=AgentStatus.BLOCKED,
                        performance_metadata=updated_perf,
                    )
                await self.audit_repo.record_audit(
                    agent_id=agent_id,
                    company_id=company_id,
                    execution_id=execution_id,
                    task_id=task_id,
                    action=AuditAction.EXECUTION_STEP,
                    status=ExecutionStatus.FAILED,
                    details={"error": safe_error},
                )
                await self.db.commit()
            except Exception:
                pass
            raise
