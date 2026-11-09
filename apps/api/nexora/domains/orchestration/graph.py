"""
Task and Dependency Graph Engine with Cycle Detection, Topological Sorting,
and Upstream-to-Downstream Output Data Pipelining.
"""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

from nexora.domains.orchestration.schemas import (
    GraphValidationResult,
    OrchestrationStatus,
    OrchestrationTaskSpec,
    TaskDependencyGraphSpec,
)


class TaskDependencyGraphManager:
    """
    Manages Directed Acyclic Graphs (DAGs) of tasks.
    Enforces strict dependency resolution, detects cycles, calculates execution tiers,
    and pipelines upstream outputs into downstream task inputs.
    """

    def __init__(self, spec: TaskDependencyGraphSpec | None = None) -> None:
        self.graph_id = spec.graph_id if spec else "default"
        self.name = spec.name if spec else "Default Graph"
        self.max_concurrency = spec.max_concurrency if spec else 4
        self._tasks: dict[str, OrchestrationTaskSpec] = {}
        if spec:
            for t in spec.tasks:
                self.add_task(t)

    def add_task(self, task: OrchestrationTaskSpec) -> None:
        self._tasks[task.id] = task

    def get_task(self, task_id: str) -> OrchestrationTaskSpec | None:
        return self._tasks.get(task_id)

    def list_tasks(self) -> list[OrchestrationTaskSpec]:
        return list(self._tasks.values())

    def validate_graph(self) -> GraphValidationResult:
        """
        Validates the task graph for:
        1. Missing dependency IDs.
        2. Circular dependencies (cycles) via DFS three-color cycle detection.
        3. Generates the canonical topological ordering.
        """
        errors: list[str] = []
        all_ids = set(self._tasks.keys())

        # Check 1: Missing dependency IDs
        for task in self._tasks.values():
            for dep_id in task.dependencies:
                if dep_id not in all_ids:
                    errors.append(f"Task '{task.id}' ({task.title}) references unknown dependency '{dep_id}'.")

        if errors:
            return GraphValidationResult(
                is_valid=False,
                has_cycles=False,
                errors=errors,
            )

        # Check 2: Cycle detection via 3-color DFS
        # 0: UNVISITED, 1: VISITING (in current recursion stack), 2: VISITED
        state: dict[str, int] = {t_id: 0 for t_id in all_ids}
        cycle_nodes: list[str] = []

        def dfs(node: str, path: list[str]) -> bool:
            state[node] = 1
            path.append(node)
            for dep in self._tasks[node].dependencies:
                if state[dep] == 1:
                    # Cycle detected
                    cycle_start = path.index(dep)
                    cycle_nodes.extend(path[cycle_start:] + [dep])
                    return True
                if state[dep] == 0:
                    if dfs(dep, path):
                        return True
            path.pop()
            state[node] = 2
            return False

        for node in all_ids:
            if state[node] == 0:
                if dfs(node, []):
                    return GraphValidationResult(
                        is_valid=False,
                        has_cycles=True,
                        cycle_nodes=cycle_nodes,
                        errors=[f"Cycle detected in task dependencies: {' -> '.join(cycle_nodes)}"],
                    )

        # Check 3: Topological sorting (Kahn's Algorithm)
        # In-degree here is the number of dependencies a task has
        in_degree: dict[str, int] = {t_id: len(self._tasks[t_id].dependencies) for t_id in all_ids}
        # Adjacency list: dependency -> list of tasks that depend on it
        dependents: dict[str, list[str]] = defaultdict(list)
        for t_id, task in self._tasks.items():
            for dep in task.dependencies:
                dependents[dep].append(t_id)

        queue = deque([t_id for t_id, deg in in_degree.items() if deg == 0])
        topological_order: list[str] = []

        while queue:
            curr = queue.popleft()
            topological_order.append(curr)
            for downstream in dependents[curr]:
                in_degree[downstream] -= 1
                if in_degree[downstream] == 0:
                    queue.append(downstream)

        if len(topological_order) != len(all_ids):
            return GraphValidationResult(
                is_valid=False,
                has_cycles=True,
                errors=["Unresolvable graph dependencies detected."],
            )

        return GraphValidationResult(
            is_valid=True,
            has_cycles=False,
            topological_order=topological_order,
            unreachable_tasks=[],
            errors=[],
        )

    def get_unblocked_tasks(
        self, completed_task_ids: set[str], in_progress_task_ids: set[str] | None = None
    ) -> list[OrchestrationTaskSpec]:
        """
        Returns all tasks whose dependencies are 100% satisfied in completed_task_ids,
        and which are not yet completed or in progress.
        Sorted by priority descending (highest priority first).
        """
        in_prog = in_progress_task_ids or set()
        unblocked: list[OrchestrationTaskSpec] = []

        for task in self._tasks.values():
            if task.id in completed_task_ids or task.id in in_prog:
                continue
            if task.status in (OrchestrationStatus.COMPLETED, OrchestrationStatus.RUNNING, OrchestrationStatus.CLAIMED):
                continue
            # All dependencies must be satisfied
            if all(dep in completed_task_ids for dep in task.dependencies):
                unblocked.append(task)

        # Sort highest priority first (5 -> 1)
        unblocked.sort(key=lambda t: t.priority, reverse=True)
        return unblocked

    def pipeline_upstream_outputs(
        self,
        target_task_id: str,
        completed_outputs: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Merges outputs from all dependencies into the target task's input payload.
        Allows downstream tasks to consume structured results from upstream tasks.
        """
        task = self.get_task(target_task_id)
        if not task:
            return {}

        combined_inputs = dict(task.input_data)
        upstream_results: dict[str, Any] = {}

        for dep_id in task.dependencies:
            if dep_id in completed_outputs:
                upstream_results[dep_id] = completed_outputs[dep_id]

        if upstream_results:
            combined_inputs["__upstream_outputs__"] = upstream_results
            # If target task expects specific keys that match upstream keys, merge them
            for dep_id, out in upstream_results.items():
                if isinstance(out, dict):
                    for k, v in out.items():
                        if k not in combined_inputs:
                            combined_inputs[k] = v

        task.input_data = combined_inputs
        return combined_inputs
