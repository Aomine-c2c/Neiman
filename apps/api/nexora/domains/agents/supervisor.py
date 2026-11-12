"""
Continuous Autonomous Development Lifecycle Supervisor.
Monitors the company's backlog, unblocks ready tasks, dispatches qualified employee agents,
executes the 10-step lifecycle against the workspace, and updates organizational telemetry.
"""

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.enums import AgentStatus, Priority, TaskStatus
from nexora.database import get_db_context
from nexora.domains.activity.broadcaster import activity_broadcaster
from nexora.domains.activity.schemas import ActivityEvent, ActivityEventType, ActivitySeverity
from nexora.domains.agents.execution import AgentExecutionEngine
from nexora.domains.agents.repository import AgentRepository
from nexora.domains.projects.models import Task
from nexora.domains.projects.repository import TaskRepository
from nexora.exceptions import NotFoundError

logger = logging.getLogger(__name__)


class SupervisorState:
    def __init__(self, company_id: uuid.UUID) -> None:
        self.company_id = company_id
        self.is_running: bool = False
        self.state: str = "PAUSED"
        self.active_cycle: int = 0
        self.last_tick_at: datetime | None = None
        self.active_task: dict[str, Any] | None = None
        self.recent_events: list[dict[str, Any]] = []

    def record_event(self, event_type: str, message: str, task_id: str | None = None) -> None:
        ev = {
            "timestamp": datetime.now(UTC).isoformat(),
            "event_type": event_type,
            "message": message,
            "task_id": task_id,
        }
        self.recent_events.insert(0, ev)
        if len(self.recent_events) > 50:
            self.recent_events.pop()


# In-memory registry for company supervisor states
_COMPANY_SUPERVISORS: dict[uuid.UUID, SupervisorState] = {}
_DAEMON_TASKS: dict[uuid.UUID, asyncio.Task] = {}
_SQLITE_MUTEX = asyncio.Lock()


def get_supervisor_state(company_id: uuid.UUID) -> SupervisorState:
    if company_id not in _COMPANY_SUPERVISORS:
        _COMPANY_SUPERVISORS[company_id] = SupervisorState(company_id)
    return _COMPANY_SUPERVISORS[company_id]


def is_supervisor_daemon_running(company_id: uuid.UUID) -> bool:
    """Check whether background supervisor loop is actively running for company."""
    task = _DAEMON_TASKS.get(company_id)
    return task is not None and not task.done()


def start_supervisor_daemon(company_id: uuid.UUID, poll_interval_seconds: float = 4.0) -> None:
    """Start the persistent autonomous supervisor daemon loop for a company."""
    state = get_supervisor_state(company_id)
    state.is_running = True
    state.state = "PLAYING"

    if is_supervisor_daemon_running(company_id):
        return

    logger.info("Starting autonomous supervisor daemon loop for company %s", company_id)
    _DAEMON_TASKS[company_id] = asyncio.create_task(
        _supervisor_daemon_loop(company_id, poll_interval_seconds)
    )


def stop_supervisor_daemon(company_id: uuid.UUID) -> None:
    """Pause and cancel background supervisor daemon loop for a company."""
    state = get_supervisor_state(company_id)
    state.is_running = False
    state.state = "PAUSED"

    task = _DAEMON_TASKS.pop(company_id, None)
    if task and not task.done():
        task.cancel()
        logger.info("Cancelled supervisor daemon for company %s", company_id)


async def _supervisor_daemon_loop(
    company_id: uuid.UUID, poll_interval_seconds: float = 4.0
) -> None:
    """Continuous autonomous background loop advancing unblocked company backlog tasks."""
    logger.info("Autonomous supervisor daemon loop active for company %s", company_id)
    while True:
        try:
            state = get_supervisor_state(company_id)
            if not state.is_running:
                await asyncio.sleep(poll_interval_seconds)
                continue

            async with get_db_context() as db:
                supervisor = ContinuousSupervisor(db)
                res = await supervisor.run_cycle(company_id)
                status = res.get("status")

                if status == "SUCCESS":
                    await asyncio.sleep(1.0)
                else:
                    await asyncio.sleep(poll_interval_seconds)

        except asyncio.CancelledError:
            logger.info("Supervisor daemon loop cancelled for company %s", company_id)
            break
        except Exception as exc:
            logger.error(
                "Supervisor daemon error for company %s: %s", company_id, exc, exc_info=True
            )
            await asyncio.sleep(poll_interval_seconds)


async def start_all_supervisors() -> None:
    """Keep company work paused until an operator explicitly starts a supervisor."""
    logger.info("Company supervisors remain paused until explicitly started by an operator.")


async def stop_all_supervisors() -> None:
    """Cleanly terminate all autonomous supervisor daemons during shutdown or test teardown."""
    tasks = list(_DAEMON_TASKS.values())
    for t in tasks:
        if not t.done():
            t.cancel()
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
    _DAEMON_TASKS.clear()
    logger.info("All autonomous supervisor daemons stopped.")


class ContinuousSupervisor:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.task_repo = TaskRepository(db)
        self.agent_repo = AgentRepository(db)
        self.execution_engine = AgentExecutionEngine(db)

    def get_status(self, company_id: uuid.UUID) -> SupervisorState:
        return get_supervisor_state(company_id)

    def toggle(self, company_id: uuid.UUID, action: str) -> SupervisorState:
        """Toggle supervisor loop state: PLAY, PAUSE, or TICK."""
        state = get_supervisor_state(company_id)
        action_upper = action.upper()

        if action_upper == "PLAY":
            state.is_running = True
            state.state = "PLAYING"
            state.record_event(
                "SUPERVISOR_RESUMED", "Continuous autonomous lifecycle resumed by operator."
            )
            start_supervisor_daemon(company_id)
        elif action_upper == "PAUSE":
            state.is_running = False
            state.state = "PAUSED"
            state.record_event(
                "SUPERVISOR_PAUSED", "Continuous autonomous lifecycle paused by operator."
            )
            stop_supervisor_daemon(company_id)
        elif action_upper == "TICK":
            state.record_event(
                "SUPERVISOR_MANUAL_TICK", "Manual single-step cycle requested by operator."
            )

        return state

    async def run_cycle(self, company_id: uuid.UUID, force: bool = False) -> dict[str, Any]:
        """
        Execute an autonomous development cycle:
        1. Find pending tasks whose dependencies are met.
        2. Assign to available agents.
        3. Execute 10-step task lifecycle.
        4. Record telemetry.
        """
        state = get_supervisor_state(company_id)
        if not state.is_running and not force:
            return {
                "cycle": state.active_cycle,
                "status": "PAUSED",
                "message": "Supervisor is paused. Toggle to PLAY to advance autonomous lifecycle.",
                "executed_tasks": [],
            }

        state.active_cycle += 1
        state.last_tick_at = datetime.now(UTC)

        all_tasks = await self.task_repo.list_by_company(company_id)
        agents = await self.agent_repo.list_by_company(company_id)

        # Index tasks by string ID
        {str(t.id): t for t in all_tasks}
        completed_task_ids = {str(t.id) for t in all_tasks if t.status == TaskStatus.COMPLETED}

        # Filter candidate tasks: PENDING or IN_PROGRESS, and all dependencies are COMPLETED
        executable_tasks: list[Task] = []
        for t in all_tasks:
            if t.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS):
                deps = t.dependencies or []
                # Check if all dependencies are satisfied
                if all(str(dep_id) in completed_task_ids for dep_id in deps):
                    executable_tasks.append(t)

        if not executable_tasks:
            all_done = len(all_tasks) > 0 and len(completed_task_ids) == len(all_tasks)
            has_blocked = any(t.status == TaskStatus.BLOCKED for t in all_tasks)
            msg = (
                f"Cycle #{state.active_cycle}: All organizational tasks completed ({len(completed_task_ids)}/{len(all_tasks)} finished)."
                if all_done
                else f"Cycle #{state.active_cycle}: Backlog clean or waiting on dependencies ({len(completed_task_ids)}/{len(all_tasks)} completed)."
            )
            state.record_event("CYCLE_IDLE", msg)
            state.active_task = None
            if state.is_running and (all_done or has_blocked):
                state.is_running = False
                state.state = "PAUSED"
                state.record_event(
                    "SUPERVISOR_AUTO_PAUSED",
                    "All tasks completed." if all_done else "Paused on BLOCKED task for operator/CTO review.",
                )
                stop_supervisor_daemon(company_id)
            return {
                "cycle": state.active_cycle,
                "status": "IDLE",
                "message": msg,
                "executed_tasks": [],
            }

        # Priority weighting: CRITICAL > HIGH > MEDIUM > LOW
        priority_weights = {
            Priority.CRITICAL: 4,
            Priority.HIGH: 3,
            Priority.MEDIUM: 2,
            Priority.LOW: 1,
        }
        executable_tasks.sort(
            key=lambda t: (
                -priority_weights.get(t.priority, 2),
                t.created_at.timestamp() if t.created_at else 0.0,
            )
        )

        # Select independent unblocked tasks for distinct available agents (up to max_concurrency)
        max_concurrency = 4
        dispatched_pairs: list[tuple[Task, Any]] = []
        assigned_agent_ids: set[uuid.UUID] = set()

        for candidate_task in executable_tasks:
            if len(dispatched_pairs) >= max_concurrency:
                break

            target_agent = None
            if candidate_task.assigned_agent_id:
                if candidate_task.assigned_agent_id not in assigned_agent_ids:
                    target_agent = await self.agent_repo.get_by_id(candidate_task.assigned_agent_id)

            if not target_agent and agents:
                for a in agents:
                    if a.id not in assigned_agent_ids and a.status in (
                        AgentStatus.AVAILABLE,
                        AgentStatus.WORKING,
                        AgentStatus.CREATED,
                        AgentStatus.CONFIGURED,
                    ):
                        target_agent = a
                        break

            if target_agent:
                assigned_agent_ids.add(target_agent.id)
                dispatched_pairs.append((candidate_task.id, candidate_task.title, target_agent.id, target_agent.name))

        if not dispatched_pairs:
            target_task = executable_tasks[0]
            msg = f"Cycle #{state.active_cycle}: Task '{target_task.title}' blocked — no workforce agents available."
            state.record_event("TASK_BLOCKED", msg, str(target_task.id))
            state.active_task = None
            return {
                "cycle": state.active_cycle,
                "status": "BLOCKED",
                "message": msg,
                "executed_tasks": [],
            }

        # Record dispatch events
        primary_task_id, primary_task_title, primary_agent_id, primary_agent_name = dispatched_pairs[0]
        state.active_task = {
            "id": str(primary_task_id),
            "title": primary_task_title,
            "agent_name": primary_agent_name,
            "started_at": datetime.now(UTC).isoformat(),
            "batch_size": len(dispatched_pairs),
        }

        for t_id, t_title, a_id, a_name in dispatched_pairs:
            state.record_event(
                "TASK_DISPATCHED",
                f"Cycle #{state.active_cycle}: Dispatched '{t_title}' to {a_name}",
                str(t_id),
            )

        # Pre-seed constitution and intelligence catalog on current session to eliminate parallel race conditions
        try:
            from nexora.domains.governance.service import GovernanceService
            from nexora.domains.intelligence.service import IntelligenceService

            gov_svc = GovernanceService(self.db)
            await gov_svc.get_or_seed_constitution(company_id)

            intel_svc = IntelligenceService(self.db)
            await intel_svc.seed_default_providers_if_empty()
            await self.db.flush()
        except Exception:
            pass

        async def _execute_single(task_id: uuid.UUID, agent_id: uuid.UUID) -> dict[str, Any]:
            sub_engine = AgentExecutionEngine(self.db)
            sub_task_repo = TaskRepository(self.db)
            sub_agent_repo = AgentRepository(self.db)

            current_agent = await sub_agent_repo.get_by_id(agent_id)
            current_task = await sub_task_repo.get_by_id(task_id)
            if not current_agent or not current_task:
                raise NotFoundError(f"Agent {agent_id} or Task {task_id} not found")

            if current_agent.status in (
                AgentStatus.CREATED,
                AgentStatus.CONFIGURED,
                AgentStatus.PAUSED,
            ):
                await sub_agent_repo.update(current_agent, status=AgentStatus.AVAILABLE)

            import os
            from nexora.domains.vcs.service import get_company_workspace_dir

            use_autonomous_code = (
                not os.environ.get("PYTEST_CURRENT_TEST")
                and (get_company_workspace_dir(str(company_id)) / ".git").exists()
            )
            exec_result = await sub_engine.execute_task(
                agent_id=current_agent.id,
                company_id=company_id,
                task_id=current_task.id,
                input_data={
                    "objective": current_task.expected_outcome or current_task.title,
                    "description": current_task.description,
                    "cycle": state.active_cycle,
                    "autonomous_code": use_autonomous_code,
                },
            )

            await sub_task_repo.update(current_task, status=TaskStatus.COMPLETED)
            await sub_agent_repo.update(current_agent, status=AgentStatus.AVAILABLE)
            await self.db.flush()

            step_count = len(exec_result.steps)
            return {
                "task_id": str(current_task.id),
                "title": current_task.title,
                "agent": current_agent.name,
                "agent_id": str(current_agent.id),
                "duration_ms": exec_result.total_duration_ms,
                "steps": step_count,
                "tokens": exec_result.tokens_consumed,
                "cost_usd": exec_result.cost_usd,
                "execution_id": str(exec_result.execution_id),
            }

        executed_tasks: list[dict[str, Any]] = []
        errors: list[str] = []

        for t_id, t_title, a_id, a_name in dispatched_pairs:
            try:
                res = await _execute_single(t_id, a_id)
                executed_tasks.append(res)
                success_msg = f"Cycle #{state.active_cycle}: {res['agent']} completed '{res['title']}' in {res['duration_ms']:.1f}ms ({res['steps']}/10 steps)."
                state.record_event("TASK_COMPLETED", success_msg, res["task_id"])

                await activity_broadcaster.broadcast(
                    str(company_id),
                    ActivityEvent(
                        company_id=str(company_id),
                        event_type=ActivityEventType.AGENT_COMPLETED,
                        severity=ActivitySeverity.INFO,
                        title=f"Autonomous Execution: {res['title']}",
                        summary=success_msg,
                        agent_id=res["agent_id"],
                        agent_name=res["agent"],
                        payload={
                            "task_id": res["task_id"],
                            "execution_id": res["execution_id"],
                            "steps": res["steps"],
                            "tokens": res["tokens"],
                            "cost_usd": res["cost_usd"],
                        },
                    ),
                )
            except Exception as exc:
                err_msg = f"Cycle #{state.active_cycle}: Error executing '{t_title}': {exc}"
                logger.error("Supervisor task execution error: %s", err_msg)
                state.record_event("EXECUTION_ERROR", err_msg, str(t_id))
                errors.append(err_msg)
                try:
                    err_task_repo = TaskRepository(self.db)
                    err_agent_repo = AgentRepository(self.db)
                    t_obj = await err_task_repo.get_by_id(t_id)
                    a_obj = await err_agent_repo.get_by_id(a_id)
                    if t_obj:
                        await err_task_repo.update(t_obj, status=TaskStatus.PENDING)
                    if a_obj:
                        await err_agent_repo.update(a_obj, status=AgentStatus.AVAILABLE)
                    await self.db.flush()
                except Exception:
                    pass

        state.active_task = None

        if executed_tasks and not errors:
            summary = (
                f"Cycle #{state.active_cycle}: Completed {len(executed_tasks)} tasks concurrently in parallel dispatch pool."
                if len(executed_tasks) > 1
                else f"Cycle #{state.active_cycle}: {executed_tasks[0]['agent']} completed '{executed_tasks[0]['title']}'."
            )
            return {
                "cycle": state.active_cycle,
                "status": "SUCCESS",
                "message": summary,
                "executed_tasks": executed_tasks,
            }
        elif executed_tasks and errors:
            return {
                "cycle": state.active_cycle,
                "status": "PARTIAL_SUCCESS",
                "message": f"Cycle #{state.active_cycle}: {len(executed_tasks)} completed, {len(errors)} failed.",
                "executed_tasks": executed_tasks,
            }
        else:
            return {
                "cycle": state.active_cycle,
                "status": "ERROR",
                "message": "; ".join(errors) if errors else "Cycle failed.",
                "executed_tasks": [],
            }
