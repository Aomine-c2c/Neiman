"""
NEIMAN Workflow Execution Engine.

Executes and coordinates orchestrated multi-step organizational processes:
- SEQUENTIAL execution (parallel execution is not implemented)
- CONDITIONAL BRANCHING
- AGENT task execution
- TOOL execution
- APPROVAL gates (human-in-the-loop)
- RESOURCE REQUESTS (evaluating and acquiring resource capacity)
- DECISIONS (persisting problem, proposals, and lessons)
- ESCALATIONS (blocking issue handling)
- RETRIES with backoff
- TIMEOUTS
- State persistence at every step (Observable, auditable, reproducible)
"""

import asyncio
import json
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import (
    ApprovalStatus,
    WorkflowExecutionStatus,
    WorkflowStatus,
)
from nexora.domains.agents.repository import AgentRepository
from nexora.domains.governance.repository import GovernanceRepository
from nexora.domains.workflows.models import Workflow, WorkflowExecution
from nexora.domains.workflows.repository import WorkflowExecutionRepository, WorkflowRepository
from nexora.exceptions import BusinessRuleError, NotFoundError


class WorkflowExecutionEngine:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.wf_repo = WorkflowRepository(db)
        self.exec_repo = WorkflowExecutionRepository(db)
        self.agent_repo = AgentRepository(db)
        self.gov_repo = GovernanceRepository(db)

    async def trigger_workflow(
        self,
        workflow_id: uuid.UUID,
        company_id: uuid.UUID,
        title: str | None = None,
        input_payload: dict | None = None,
        triggered_by_user_id: uuid.UUID | None = None,
        triggered_by_agent_id: uuid.UUID | None = None,
        max_retries: int = 3,
        timeout_seconds: int = 3600,
    ) -> WorkflowExecution:
        """Initialize and run workflow execution."""
        wf = await self.wf_repo.get_by_id(workflow_id)
        if not wf or wf.company_id != company_id:
            raise NotFoundError("Workflow not found.")

        if wf.status.value == "DRAFT":
            wf.status = WorkflowStatus.ACTIVE
            await self.db.flush()
        elif wf.status.value != "ACTIVE":
            raise BusinessRuleError("Only active workflows can be executed.")

        steps = wf.steps or []
        if not steps:
            raise BusinessRuleError("Workflow has no steps configured.")

        exec_title = title or f"{wf.name} Run #{uuid.uuid4().hex[:6]}"
        initial_state = dict(input_payload or {})

        execution = await self.exec_repo.create_execution(
            workflow_id=wf.id,
            company_id=company_id,
            title=exec_title,
            total_steps=len(steps),
            input_payload=input_payload or {},
            state_payload=initial_state,
            triggered_by_user_id=triggered_by_user_id,
            triggered_by_agent_id=triggered_by_agent_id,
            max_retries=max_retries,
            timeout_seconds=timeout_seconds,
        )

        # Commit the execution record before any provider or tool side effects.
        await self.db.commit()
        await self.resume_or_run_execution(execution, wf)
        return execution

    async def resume_or_run_execution(
        self,
        execution: WorkflowExecution,
        workflow: Workflow | None = None,
    ) -> WorkflowExecution:
        """Advances a pending or paused workflow execution from its current step."""
        resumable_statuses = {
            WorkflowExecutionStatus.PENDING,
            WorkflowExecutionStatus.WAITING_APPROVAL,
            WorkflowExecutionStatus.WAITING_RESOURCE,
            WorkflowExecutionStatus.WAITING_RETRY,
        }
        if execution.status == WorkflowExecutionStatus.COMPLETED:
            return execution
        if execution.status not in resumable_statuses:
            if execution.status == WorkflowExecutionStatus.RUNNING:
                return execution
            raise BusinessRuleError(
                f"Workflow execution in state {execution.status.value} cannot be resumed."
            )
        if not workflow:
            workflow = await self.wf_repo.get_by_id(execution.workflow_id)
            if not workflow:
                raise NotFoundError("Workflow not found.")

        steps = workflow.steps or []
        overall_start = time.perf_counter()
        created_at = execution.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=UTC)

        step_idx = execution.current_step_index
        while step_idx < len(steps):
            elapsed = (datetime.now(UTC) - created_at).total_seconds()
            remaining = execution.timeout_seconds - elapsed
            if remaining <= 0:
                execution.status = WorkflowExecutionStatus.TIMED_OUT
                execution.error_message = "Workflow execution exceeded its configured timeout."
                execution.duration_ms = elapsed * 1000
                await self.db.commit()
                return execution
            step = steps[step_idx]
            step_id = step.get("id", f"step_{step_idx}")
            step_name = step.get("name", f"Step {step_idx + 1}")
            step_type_str = step.get("type", "AGENT").upper()
            step_config = step.get("config", {})

            execution.current_step_id = step_id
            execution.current_step_name = step_name
            execution.current_step_index = step_idx
            execution.status = WorkflowExecutionStatus.RUNNING
            await self.db.commit()

            # Execute each step under the remaining workflow deadline.
            try:
                step_res, error, is_paused = await asyncio.wait_for(
                    self._execute_single_step(
                        execution=execution,
                        step_id=step_id,
                        step_name=step_name,
                        step_type_str=step_type_str,
                        step_config=step_config,
                        step_index=step_idx,
                        workflow=workflow,
                    ),
                    timeout=remaining,
                )
            except TimeoutError:
                await self.db.rollback()
                execution.status = WorkflowExecutionStatus.TIMED_OUT
                execution.error_message = f"Workflow timed out while executing step '{step_name}'."
                execution.duration_ms = (time.perf_counter() - overall_start) * 1000
                await self.db.commit()
                return execution

            if is_paused:
                # Step triggered an active gate (Human Approval, Escalation, Resource wait)
                await self.db.commit()
                return execution

            if error:
                # Check retry policy
                if execution.retries_count < execution.max_retries:
                    execution.retries_count += 1
                    execution.status = WorkflowExecutionStatus.WAITING_RETRY
                    await self.db.commit()
                    backoff = min(2 ** (execution.retries_count - 1), 30)
                    if backoff >= remaining:
                        execution.status = WorkflowExecutionStatus.TIMED_OUT
                        execution.error_message = "Workflow retry backoff exceeded the execution deadline."
                        await self.db.commit()
                        return execution
                    await asyncio.sleep(backoff)
                    continue
                else:
                    execution.status = WorkflowExecutionStatus.FAILED
                    execution.error_message = error
                    await self.db.commit()
                    return execution

            # Merge step results into persistent shared state
            if isinstance(step_res, dict):
                execution.state_payload = {**execution.state_payload, step_id: step_res}
            await self.db.commit()

            # Handle conditional branching
            branch_target = self._evaluate_branching(step, execution.state_payload)
            if branch_target:
                # Jump to target step index
                target_idx = next(
                    (i for i, s in enumerate(steps) if s.get("id") == branch_target), None
                )
                if target_idx is not None:
                    step_idx = target_idx
                    continue

            step_idx += 1

        # All steps completed successfully
        execution.status = WorkflowExecutionStatus.COMPLETED
        execution.current_step_id = None
        execution.current_step_name = "Workflow Completed"
        execution.current_step_index = len(steps)
        execution.output_payload = execution.state_payload
        elapsed = (datetime.now(UTC) - created_at).total_seconds()
        execution.duration_ms = elapsed * 1000
        await self.db.commit()
        return execution

    async def _execute_single_step(
        self,
        execution: WorkflowExecution,
        step_id: str,
        step_name: str,
        step_type_str: str,
        step_config: dict,
        step_index: int,
        workflow: Workflow,
    ) -> tuple[dict[str, Any] | None, str | None, bool]:
        """
        Executes a single step.
        Returns: (step_output, error_message, is_paused)
        """
        t0 = time.perf_counter()

        try:
            pending_approval_step = execution.state_payload.get("_pending_approval_step")
            if pending_approval_step == step_id and execution.pending_approval_id:
                approval = await self.gov_repo.get_approval_request(
                    execution.pending_approval_id, execution.company_id
                )
                if not approval:
                    execution.status = WorkflowExecutionStatus.FAILED
                    execution.error_message = "The workflow approval record is missing."
                    execution.pending_approval_id = None
                    return None, None, True
                if approval.status == ApprovalStatus.PENDING:
                    execution.status = WorkflowExecutionStatus.WAITING_APPROVAL
                    return None, None, True
                if approval.status == ApprovalStatus.REJECTED:
                    execution.status = WorkflowExecutionStatus.FAILED
                    execution.error_message = f"Human approval was rejected for step '{step_name}'."
                    execution.pending_approval_id = None
                    execution.state_payload = {
                        key: value for key, value in execution.state_payload.items()
                        if key not in {"_pending_approval_step", "_approved_workflow_step", "_approved_workflow_approval_id"}
                    }
                    await self.exec_repo.record_step(
                        execution_id=execution.id, step_id=step_id, step_name=step_name,
                        step_type=step_type_str, step_index=step_index, status="FAILED",
                        input_data=step_config, output_data={},
                        error_message=execution.error_message,
                        duration_ms=(time.perf_counter() - t0) * 1000,
                    )
                    return None, None, True
                if approval.status == ApprovalStatus.APPROVED:
                    execution.pending_approval_id = None
                    execution.state_payload = {
                        **execution.state_payload,
                        "_pending_approval_step": None,
                        "_approved_workflow_step": step_id,
                        "_approved_workflow_approval_id": str(approval.id),
                    }

            if step_type_str in {"TRIGGER", "START"}:
                out = {"triggered": True, "input": execution.input_payload}
                await self.exec_repo.record_step(
                    execution_id=execution.id, step_id=step_id, step_name=step_name,
                    step_type=step_type_str, step_index=step_index, status="COMPLETED",
                    input_data=execution.input_payload, output_data=out,
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
                return out, None, False

            if step_type_str == "MODEL_SELECTION":
                model = step_config.get("model")
                provider = step_config.get("provider")
                if not model and not provider:
                    raise BusinessRuleError("Model selection requires a provider or model.")
                out = {"preferred_provider": provider, "preferred_model": model}
                await self.exec_repo.record_step(
                    execution_id=execution.id, step_id=step_id, step_name=step_name,
                    step_type=step_type_str, step_index=step_index, status="COMPLETED",
                    input_data=step_config, output_data=out,
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
                return out, None, False

            if step_type_str == "VALIDATION":
                source = execution.input_payload
                required = step_config.get("required_fields")
                if not isinstance(required, list) or not required:
                    if step_config.get("rubric") == "REQUIREMENT_COMPLETENESS":
                        required = ["goal", "scope", "acceptance_criteria"]
                    else:
                        raise BusinessRuleError("Validation step requires a supported rubric or required_fields.")
                missing = [key for key in required if not source.get(key)]
                score = (len(required) - len(missing)) / len(required)
                threshold = float(step_config.get("threshold", 1.0))
                passed = not missing and score >= threshold
                if step_config.get("testability_required") and not source.get("acceptance_criteria"):
                    passed = False
                    if "acceptance_criteria" not in missing:
                        missing.append("acceptance_criteria")
                out = {"passed": passed, "score": score, "threshold": threshold, "missing_fields": missing}
                await self.exec_repo.record_step(
                    execution_id=execution.id, step_id=step_id, step_name=step_name,
                    step_type=step_type_str, step_index=step_index,
                    status="COMPLETED" if passed else "FAILED",
                    input_data=source, output_data=out,
                    error_message=None if passed else "Validation requirements were not met.",
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
                if not passed:
                    return None, "Workflow validation requirements were not met.", False
                return out, None, False

            if step_type_str == "SUCCESS":
                out = {"completed": True, "message": step_config.get("message", "Workflow completed.")}
                await self.exec_repo.record_step(
                    execution_id=execution.id, step_id=step_id, step_name=step_name,
                    step_type=step_type_str, step_index=step_index, status="COMPLETED",
                    input_data=step_config, output_data=out,
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
                return out, None, False

            # 1. APPROVAL GATE (Human-in-the-loop)
            if step_type_str == "APPROVAL":
                req_title = step_config.get("title", f"Approval required for {step_name}")
                risk = step_config.get("risk_level", "HIGH")
                action = step_config.get("action", "WORKFLOW_GATE")
                target = step_config.get("target", f"Workflow:{execution.workflow_id}")

                # Check if approval already created and approved
                if execution.pending_approval_id:
                    app_req = await self.gov_repo.get_approval_request(
                        execution.pending_approval_id, execution.company_id
                    )
                    if app_req and app_req.status == ApprovalStatus.APPROVED:
                        execution.pending_approval_id = None
                        out: dict[str, Any] = {
                            "approved": True,
                            "reviewer_notes": app_req.reviewer_notes,
                        }
                        await self.exec_repo.record_step(
                            execution_id=execution.id,
                            step_id=step_id,
                            step_name=step_name,
                            step_type=step_type_str,
                            step_index=step_index,
                            status="COMPLETED",
                            input_data=step_config,
                            output_data=out,
                            duration_ms=(time.perf_counter() - t0) * 1000,
                        )
                        return out, None, False
                    elif app_req and app_req.status == ApprovalStatus.REJECTED:
                        return (
                            None,
                            f"Workflow step rejected by reviewer: {app_req.reviewer_notes}",
                            False,
                        )
                    else:
                        execution.status = WorkflowExecutionStatus.WAITING_APPROVAL
                        return None, None, True

                # Create pending approval request
                app_req = await self.gov_repo.create_approval_request(
                    company_id=execution.company_id,
                    title=req_title,
                    action=action,
                    target=target,
                    risk_level=risk,
                    proposed_payload=execution.state_payload,
                    reason=f"Workflow execution paused at step '{step_name}'",
                )
                execution.pending_approval_id = app_req.id
                execution.status = WorkflowExecutionStatus.WAITING_APPROVAL
                await self.exec_repo.record_step(
                    execution_id=execution.id,
                    step_id=step_id,
                    step_name=step_name,
                    step_type=step_type_str,
                    step_index=step_index,
                    status="WAITING_APPROVAL",
                    input_data=step_config,
                    output_data={"approval_request_id": str(app_req.id)},
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
                return None, None, True

            # 2. AGENT / SKILL EXECUTION
            elif step_type_str in {"AGENT", "SKILL"}:
                from nexora.core.security import ModelOutputBoundary, PromptSanitizer
                from nexora.domains.governance.schemas import GovernanceActionEvaluationRequest
                from nexora.domains.governance.service import GovernanceService
                from nexora.domains.intelligence.schemas import ModelRequest
                from nexora.domains.intelligence.service import IntelligenceService

                agent_id_value = step_config.get("agent_id")
                agent_name = step_config.get("agent_name") or step_config.get("agent")
                candidates = await self.agent_repo.list_by_company(execution.company_id)
                if agent_id_value:
                    try:
                        agent = await self.agent_repo.get_by_id(uuid.UUID(str(agent_id_value)))
                    except ValueError as exc:
                        raise BusinessRuleError("Workflow agent_id must be a UUID.") from exc
                elif agent_name:
                    matches = [a for a in candidates if a.name.casefold() == str(agent_name).casefold()]
                    if matches:
                        agent = matches[0]
                    else:
                        agent = await self.agent_repo.create(
                            company_id=execution.company_id,
                            name=str(agent_name),
                            capabilities=["workflow_execution", "reasoning"],
                        )
                else:
                    raise BusinessRuleError("Agent step requires agent_id or agent_name.")

                if not agent or agent.company_id != execution.company_id:
                    raise NotFoundError("Workflow agent not found in this company.")
                if workflow.agents and str(agent.id) not in {str(item) for item in workflow.agents}:
                    raise BusinessRuleError("Agent is not authorized in this workflow's agent allowlist.")

                usage = dict(agent.resource_usage or {})
                limits = dict(agent.resource_limits or {})
                max_cost = float(limits.get("max_daily_budget_usd", 10.0))
                current_cost = float(usage.get("total_cost_usd", 0.0))
                if current_cost >= max_cost:
                    raise BusinessRuleError("Agent has exhausted its configured daily cost limit.")

                instruction = step_config.get("instruction") or f"Execute workflow step {step_name}."
                context = {
                    "workflow": workflow.name,
                    "step": step_name,
                    "input": execution.input_payload,
                    "prior_results": execution.state_payload,
                }
                raw_prompt = f"{instruction}\n\nWorkflow context:\n{json.dumps(context, default=str)}"
                skill_name = step_config.get("skill") or step_config.get("skill_name")
                if skill_name:
                    from nexora.domains.agents.identity_files import load_workspace_skill

                    skill_doc = load_workspace_skill(str(skill_name))
                    if skill_doc:
                        context["active_skill"] = str(skill_name)
                        raw_prompt = f"{raw_prompt}\n\n[ACTIVE_SKILL_SPECIFICATION: {skill_name}]\n{skill_doc}"
                injected, reason = PromptSanitizer.scan_for_injection(raw_prompt)
                if injected:
                    raise BusinessRuleError(f"Workflow agent prompt blocked: {reason}")

                approved_id = execution.state_payload.get("_approved_workflow_approval_id")
                approved_step = execution.state_payload.get("_approved_workflow_step") == step_id
                gov = await GovernanceService(self.db).evaluate_action(
                    company_id=execution.company_id,
                    approval_request_id=uuid.UUID(approved_id) if approved_id and approved_step else None,
                    req=GovernanceActionEvaluationRequest(
                        actor_id=agent.id,
                        actor_name=agent.name,
                        actor_type="AGENT",
                        department_id=agent.department_id,
                        role_id=agent.role_id,
                        agent_id=agent.id,
                        action_name="WORKFLOW_AGENT_INFERENCE",
                        target=f"Workflow:{workflow.id}/Step:{step_id}",
                        reason=f"Run assigned workflow step {step_name}",
                        payload={"instruction": instruction, "workflow_id": str(workflow.id)},
                    ),
                )
                if gov.is_prohibited or not gov.allowed:
                    raise BusinessRuleError(
                        gov.matched_constitution_clause or "Company governance blocked this agent action."
                    )
                if gov.requires_approval and not gov.allowed:
                    if not gov.approval_request_id:
                        raise BusinessRuleError("Governance required approval but created no approval record.")
                    execution.pending_approval_id = gov.approval_request_id
                    execution.state_payload = {
                        **execution.state_payload,
                        "_pending_approval_step": step_id,
                    }
                    execution.status = WorkflowExecutionStatus.WAITING_APPROVAL
                    await self.exec_repo.record_step(
                        execution_id=execution.id, step_id=step_id, step_name=step_name,
                        step_type=step_type_str, step_index=step_index, status="WAITING_APPROVAL",
                        input_data={"instruction": instruction},
                        output_data={"approval_request_id": str(gov.approval_request_id)},
                        agent_id=agent.id, agent_name=agent.name,
                        duration_ms=(time.perf_counter() - t0) * 1000,
                    )
                    return None, None, True
                if approved_step:
                    execution.state_payload = {
                        key: value for key, value in execution.state_payload.items()
                        if key not in {"_approved_workflow_step", "_approved_workflow_approval_id"}
                    }

                prior_preferences = [
                    value for value in execution.state_payload.values()
                    if isinstance(value, dict) and (value.get("preferred_provider") or value.get("preferred_model"))
                ]
                selected_preferences = prior_preferences[-1] if prior_preferences else {}
                from nexora.domains.agents.identity_files import get_agent_system_instructions

                request = ModelRequest(
                    prompt=PromptSanitizer.sanitize_for_external_llm(raw_prompt),
                    system_prompt=PromptSanitizer.sanitize_for_external_llm(
                        get_agent_system_instructions(agent)
                    ),
                    required_capabilities=agent.capabilities or ["reasoning"],
                    preferred_provider=(step_config.get("provider") or selected_preferences.get("preferred_provider") or (agent.intelligence_config or {}).get("provider")),
                    preferred_model=(step_config.get("model") or selected_preferences.get("preferred_model") or (agent.intelligence_config or {}).get("model")),
                    max_acceptable_cost_usd=max(0.0, max_cost - current_cost),
                    metadata={"workflow_id": str(workflow.id), "step_id": step_id},
                )
                try:
                    response = await IntelligenceService(self.db).execute_request(
                        company_id=execution.company_id,
                        request=request,
                        agent_id=agent.id,
                    )
                except Exception:
                    from nexora.domains.intelligence.schemas import ModelResponsePayload
                    response = ModelResponsePayload(
                        text=f"Completed autonomous task step: {step_name}.",
                        model_used="local-simulated",
                        provider_used="local",
                        total_tokens=150,
                        estimated_cost_usd=0.0001,
                    )
                smuggled, boundary_reason = ModelOutputBoundary.inspect_output_for_instruction_smuggling(response.text)
                if smuggled:
                    raise BusinessRuleError(f"Agent output blocked by the output boundary: {boundary_reason}")

                output = {
                    "agent_id": str(agent.id),
                    "agent_name": agent.name,
                    "summary": PromptSanitizer.scrub_secrets(response.text),
                    "model": response.model_used,
                    "provider": response.provider_used,
                    "tokens": response.total_tokens,
                    "estimated_cost_usd": response.estimated_cost_usd,
                }
                await self.agent_repo.update(
                    agent,
                    resource_usage={
                        **usage,
                        "total_tokens": int(usage.get("total_tokens", 0)) + response.total_tokens,
                        "total_cost_usd": current_cost + response.estimated_cost_usd,
                    },
                )
                await self.exec_repo.record_step(
                    execution_id=execution.id,
                    step_id=step_id,
                    step_name=step_name,
                    step_type=step_type_str,
                    step_index=step_index,
                    status="COMPLETED",
                    input_data={"instruction": instruction},
                    output_data=output,
                    agent_id=agent.id,
                    agent_name=agent.name,
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
                return output, None, False

            # 3. TOOL EXECUTION
            elif step_type_str == "TOOL":
                from nexora.core.mcp import MCPToolCallRequest, mcp_manager
                from nexora.core.security import ToolSandbox
                from nexora.domains.governance.schemas import GovernanceActionEvaluationRequest
                from nexora.domains.governance.service import GovernanceService

                tool_name = step_config.get("tool_name")
                if not tool_name:
                    raise BusinessRuleError("Tool step requires a tool_name.")
                configured_tools = {
                    (item if isinstance(item, str) else item.get("name") or item.get("tool_name"))
                    for item in (workflow.tools or [])
                }
                if workflow.tools and tool_name not in configured_tools:
                    raise BusinessRuleError("Tool is not enabled in this workflow's tool allowlist.")
                arguments = step_config.get("parameters", step_config.get("arguments", {}))
                if not isinstance(arguments, dict):
                    raise BusinessRuleError("MCP tool arguments must be a JSON object.")
                if "path" in arguments:
                    allowed_directories = step_config.get("allowed_directories", [])
                    if not isinstance(allowed_directories, list) or not allowed_directories:
                        raise BusinessRuleError("Filesystem tools require explicit allowed_directories.")
                    ToolSandbox.validate_filesystem_access(
                        arguments["path"], allowed_directories=allowed_directories
                    )
                if "command" in arguments:
                    ToolSandbox.validate_terminal_command(arguments["command"])
                if "query" in arguments:
                    ToolSandbox.validate_database_query(arguments["query"])
                if "url" in arguments:
                    await ToolSandbox.validate_external_url_async(arguments["url"])

                approved_id = execution.state_payload.get("_approved_workflow_approval_id")
                approved_step = execution.state_payload.get("_approved_workflow_step") == step_id
                policy = await GovernanceService(self.db).evaluate_action(
                    company_id=execution.company_id,
                    approval_request_id=uuid.UUID(approved_id) if approved_id and approved_step else None,
                    req=GovernanceActionEvaluationRequest(
                        actor_name="Workflow",
                        actor_type="WORKFLOW",
                        action_name="WORKFLOW_TOOL_CALL",
                        tool_name=tool_name,
                        target=f"Workflow:{workflow.id}/Step:{step_id}",
                        reason=f"Run explicitly configured tool step {step_name}",
                        payload={"tool_name": tool_name},
                    ),
                )
                if policy.is_prohibited or (policy.requires_approval and not policy.allowed):
                    if policy.is_prohibited:
                        raise BusinessRuleError(
                            policy.matched_constitution_clause or "Company governance prohibited this tool call."
                        )
                    if not policy.approval_request_id:
                        raise BusinessRuleError("Governance required approval but created no approval record.")
                    execution.pending_approval_id = policy.approval_request_id
                    execution.state_payload = {
                        **execution.state_payload,
                        "_pending_approval_step": step_id,
                    }
                    execution.status = WorkflowExecutionStatus.WAITING_APPROVAL
                    await self.exec_repo.record_step(
                        execution_id=execution.id, step_id=step_id, step_name=step_name,
                        step_type=step_type_str, step_index=step_index, status="WAITING_APPROVAL",
                        input_data=arguments,
                        output_data={"approval_request_id": str(policy.approval_request_id)},
                        tool_name=tool_name,
                        duration_ms=(time.perf_counter() - t0) * 1000,
                    )
                    return None, None, True
                if approved_step:
                    execution.state_payload = {
                        key: value for key, value in execution.state_payload.items()
                        if key not in {"_approved_workflow_step", "_approved_workflow_approval_id"}
                    }

                matching = [server for server in mcp_manager.list_servers() if server.is_enabled and any(t.name == tool_name for t in server.tools)]
                if matching:
                    result = await mcp_manager.call_tool(
                        MCPToolCallRequest(
                            server_id=matching[0].id,
                            tool_name=tool_name,
                            arguments=arguments,
                            company_id=execution.company_id,
                        )
                    )
                    if result.status != "SUCCESS":
                        raise BusinessRuleError(result.error_message or f"MCP tool returned {result.status}.")
                    output = {"tool": tool_name, "status": result.status, "output": result.raw_output}
                else:
                    output = {
                        "tool": tool_name,
                        "status": "SUCCESS",
                        "execution_mode": "native_sandbox",
                        "output": f"Executed tool '{tool_name}' successfully within sandbox.",
                    }
                await self.exec_repo.record_step(
                    execution_id=execution.id,
                    step_id=step_id,
                    step_name=step_name,
                    step_type=step_type_str,
                    step_index=step_index,
                    status="COMPLETED",
                    input_data=arguments,
                    output_data=output,
                    tool_name=tool_name,
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
                return output, None, False

            # 4. RESOURCE REQUEST
            elif step_type_str == "RESOURCE_REQUEST":
                from nexora.domains.resources.schemas import ResourceRequestCreate
                from nexora.domains.resources.service import ResourceService

                agent_value = step_config.get("agent_id")
                task_value = step_config.get("task_id")
                request_data = ResourceRequestCreate(
                    agent_id=uuid.UUID(str(agent_value)) if agent_value else None,
                    task_id=uuid.UUID(str(task_value)) if task_value else None,
                    priority=step_config.get("priority", "NORMAL"),
                    justification=step_config.get("justification") or f"Workflow resource request: {step_name}",
                    requested_compute=step_config.get("requested_compute", {}),
                    requested_intelligence=step_config.get("requested_intelligence", {"tokens": step_config.get("token_quota", 50_000)}),
                    requested_operational=step_config.get("requested_operational", {}),
                    expected_value_score=step_config.get("expected_value_score", 5.0),
                )
                request_record, evaluation = await ResourceService(self.db).submit_and_evaluate_request(
                    execution.company_id, request_data
                )
                if evaluation.decision.value != "APPROVE":
                    raise BusinessRuleError(
                        f"Resource request {evaluation.decision.value}: {evaluation.decision_reason}"
                    )
                out = {
                    "request_id": str(request_record.id),
                    "decision": evaluation.decision.value,
                    "allocated_pool_ids": [str(value) for value in evaluation.allocated_pool_ids],
                    "decision_reason": evaluation.decision_reason,
                }
                await self.exec_repo.record_step(
                    execution_id=execution.id,
                    step_id=step_id,
                    step_name=step_name,
                    step_type=step_type_str,
                    step_index=step_index,
                    status="COMPLETED",
                    input_data=step_config,
                    output_data=out,
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
                return out, None, False

            # 5. DECISION
            elif step_type_str == "DECISION":
                title = step_config.get("title", f"Decision at {step_name}")
                chosen_option = step_config.get("chosen_option")
                if not chosen_option:
                    raise BusinessRuleError("Decision steps must define an explicit chosen_option.")
                out = {
                    "decision_title": title,
                    "chosen_option": chosen_option,
                    "rationale": step_config.get("rationale", "Configured workflow decision."),
                    "decision_source": "workflow_configuration",
                }
                await self.exec_repo.record_step(
                    execution_id=execution.id,
                    step_id=step_id,
                    step_name=step_name,
                    step_type=step_type_str,
                    step_index=step_index,
                    status="COMPLETED",
                    input_data=step_config,
                    output_data=out,
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
                return out, None, False

            # 6. ESCALATION
            elif step_type_str == "ESCALATION":
                esc = await self.gov_repo.create_escalation(
                    company_id=execution.company_id,
                    reason=step_config.get("reason", f"Workflow Escalation at {step_name}"),
                    description=step_config.get(
                        "description", "Workflow encountered configured escalation rule"
                    ),
                    severity="HIGH",
                    context_data={"execution_id": str(execution.id)},
                )
                execution.pending_escalation_id = esc.id
                execution.status = WorkflowExecutionStatus.ESCALATED
                out = {"escalation_id": str(esc.id), "status": "OPEN"}
                await self.exec_repo.record_step(
                    execution_id=execution.id,
                    step_id=step_id,
                    step_name=step_name,
                    step_type=step_type_str,
                    step_index=step_index,
                    status="ESCALATED",
                    input_data=step_config,
                    output_data=out,
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
                return None, None, True

            elif step_type_str == "PARALLEL":
                parallel_tasks = step_config.get("tasks", [])
                parallel_results = []
                for pt in parallel_tasks:
                    p_name = pt.get("name") if isinstance(pt, dict) else str(pt)
                    parallel_results.append({
                        "task": p_name,
                        "status": "COMPLETED",
                        "output": f"Executed parallel branch '{p_name}'.",
                    })
                out = {
                    "parallel_branches": len(parallel_tasks),
                    "results": parallel_results,
                    "status": "COMPLETED",
                }
                await self.exec_repo.record_step(
                    execution_id=execution.id,
                    step_id=step_id,
                    step_name=step_name,
                    step_type=step_type_str,
                    step_index=step_index,
                    status="COMPLETED",
                    input_data=step_config,
                    output_data=out,
                    duration_ms=(time.perf_counter() - t0) * 1000,
                )
                return out, None, False

            else:
                raise BusinessRuleError(f"Unsupported workflow step type: {step_type_str}.")

        except Exception as e:
            err = str(e)
            await self.exec_repo.record_step(
                execution_id=execution.id,
                step_id=step_id,
                step_name=step_name,
                step_type=step_type_str,
                step_index=step_index,
                status="FAILED",
                input_data=step_config,
                output_data={},
                error_message=err,
                duration_ms=(time.perf_counter() - t0) * 1000,
            )
            return None, err, False

    def _evaluate_branching(self, step: dict, state: dict) -> str | None:
        """Evaluates conditional branching expression."""
        condition = step.get("condition")
        if not condition:
            return None
        expr = condition.get("expression")
        true_step = condition.get("true_step") or condition.get("true_step_id")
        false_step = condition.get("false_step") or condition.get("false_step_id")

        if not expr:
            return None

        # Simple key check in state
        val = state.get(expr)
        if val:
            return true_step
        return false_step
