"""
NEIMAN CLI & TUI Operator Console (neiman-cli).
Command-line operator interface for Autonomous CTO and Workforce Swarm:
- High-level directive intake & autonomous task decomposition.
- Proactive proposal inspection and approval gate.
- Continuous development lifecycle supervisor controls (Play / Pause / Tick).
- Workforce swarm telemetry and live execution trace.
- Interactive terminal TUI launcher.
"""

import argparse
import asyncio
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

console = Console()

def get_config_dir() -> str:
    return os.path.expanduser(os.environ.get("XDG_CONFIG_HOME", "~/.config")) + "/neiman"


def get_config_file() -> str:
    return os.path.join(get_config_dir(), "cli.json")


CONFIG_DIR = get_config_dir()
CONFIG_FILE = get_config_file()


def load_cli_config() -> dict[str, Any]:
    """Load persistent CLI configuration from disk."""
    cfg_file = get_config_file()
    if os.path.exists(cfg_file):
        try:
            if os.path.islink(cfg_file):
                return {}
            os.chmod(cfg_file, 0o600)
            with open(cfg_file) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_cli_config(cfg: dict[str, Any]) -> None:
    """Save persistent CLI configuration to disk."""
    cfg_dir = get_config_dir()
    cfg_file = get_config_file()
    os.makedirs(cfg_dir, exist_ok=True)
    os.chmod(cfg_dir, 0o700)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=cfg_dir, prefix=".cli.", delete=False
        ) as f:
            temp_path = f.name
            os.chmod(temp_path, 0o600)
            json.dump(cfg, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_path, cfg_file)
        os.chmod(cfg_file, 0o600)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def get_configured_api_url() -> str:
    """Resolve API base URL from ENV, config file, or default."""
    cfg = load_cli_config()
    return os.environ.get("NEIMAN_API_URL") or cfg.get("api_url") or "http://127.0.0.1:8000/api/v1"


def get_configured_company_id() -> str | None:
    """Resolve pinned company ID from ENV or config file."""
    cfg = load_cli_config()
    return os.environ.get("NEIMAN_COMPANY_ID") or cfg.get("company_id")


def get_configured_token() -> str | None:
    """Resolve auth token from ENV or config file."""
    cfg = load_cli_config()
    return os.environ.get("NEIMAN_AUTH_TOKEN") or cfg.get("token")


def get_configured_timeout() -> float:
    """Resolve default HTTP timeout."""
    cfg = load_cli_config()
    try:
        return float(cfg.get("timeout", 15.0))
    except (ValueError, TypeError):
        return 15.0


_client_factory: Any = None


def set_client_factory(factory: Any) -> None:
    """Set global custom client factory (used for in-process test fixtures)."""
    global _client_factory
    _client_factory = factory


def get_http_client(timeout: float | None = None) -> httpx.AsyncClient:
    """Create configured async HTTP client with authentication headers and timeout."""
    if _client_factory is not None:
        return _client_factory(timeout)
    t = timeout or get_configured_timeout()
    token = get_configured_token()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return httpx.AsyncClient(timeout=t, headers=headers)


class _DynamicApiUrl(str):
    def __str__(self) -> str:
        return get_configured_api_url()

    def __format__(self, format_spec: str) -> str:
        return get_configured_api_url()


DEFAULT_API_URL = _DynamicApiUrl("http://127.0.0.1:8000/api/v1")


async def get_active_company_id(
    client: httpx.AsyncClient, api_url: str | None = None
) -> str | None:
    """Resolve active company ID from pinned config or backend discovery."""
    configured = get_configured_company_id()
    if configured:
        return configured
    base = api_url or get_configured_api_url()
    try:
        res = await client.get(f"{base}/companies/me")
        if res.status_code == 200:
            companies = res.json()
            if companies and len(companies) > 0:
                return companies[0]["id"]
    except Exception:
        pass
    try:
        res = await client.get(f"{base}/companies")
        if res.status_code == 200:
            companies = res.json()
            if companies and len(companies) > 0:
                return companies[0]["id"]
    except Exception:
        pass
    return None


async def cmd_status(company_id: str | None = None) -> None:
    """Display organizational state, CTO identity, and supervisor lifecycle."""
    async with get_http_client(timeout=10.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print(
                "[bold red]Error:[/bold red] Could not connect to NEIMAN API or no company exists."
            )
            console.print(f"[dim]Attempted: {DEFAULT_API_URL}/companies/me[/dim]")
            return

        cto_res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/cto/status")
        sup_res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/cto/supervisor/status")

        if cto_res.status_code != 200 or sup_res.status_code != 200:
            console.print(f"[bold red]Error fetching status:[/bold red] {cto_res.text}")
            return

        cto_data = cto_res.json()
        sup_data = sup_res.json()

        # Render Header Panel
        status_color = "green" if sup_data["is_running"] else "yellow"
        header_text = Text()
        header_text.append("NEIMAN OS ", style="bold cyan")
        header_text.append("// AUTONOMOUS OPERATIONS CONSOLE\n", style="bold white")
        header_text.append(
            f"Company ID: {comp_id} | CTO: {cto_data['cto_agent_name']}\n", style="dim"
        )
        header_text.append("Supervisor State: ", style="bold")
        header_text.append(f"[{sup_data['state']}]", style=f"bold {status_color}")
        header_text.append(f" (Cycle #{sup_data['active_cycle']})", style="dim")

        console.print(Panel(header_text, border_style="cyan", box=box.ROUNDED))

        # Metrics Table
        table = Table(box=box.SIMPLE_HEAVY, show_header=True, header_style="bold cyan")
        table.add_column("Total Workforce", justify="center")
        table.add_column("Working Agents", justify="center")
        table.add_column("Pending Tasks", justify="center")
        table.add_column("In Progress", justify="center")
        table.add_column("Completed Tasks", justify="center")
        table.add_column("Pending Proposals", justify="center")

        table.add_row(
            str(cto_data["total_agents"]),
            f"[bold green]{cto_data['working_agents']}[/bold green]",
            f"[bold yellow]{sup_data['pending_tasks_count']}[/bold yellow]",
            f"[bold cyan]{sup_data['in_progress_tasks_count']}[/bold cyan]",
            f"[bold green]{sup_data['completed_tasks_count']}[/bold green]",
            f"[bold magenta]{cto_data['pending_proposals_count']}[/bold magenta]",
        )
        console.print(table)

        # Recent Events Feed
        if sup_data.get("recent_events"):
            console.print("\n[bold cyan]Recent Autonomous Telemetry Stream:[/bold cyan]")
            for ev in sup_data["recent_events"][:5]:
                console.print(
                    f"  [dim]{ev.get('timestamp', '')[:19]}[/dim] [bold yellow]{ev.get('event_type')}[/bold yellow]: {ev.get('message')}"
                )


async def cmd_directive(
    directive: str, priority: str = "HIGH", company_id: str | None = None
) -> None:
    """Send high-level directive to the CTO Agent for decomposition and delegation."""
    async with get_http_client(timeout=30.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        with console.status(f"[bold cyan]CTO analyzing directive: '{directive}'...[/bold cyan]"):
            res = await client.post(
                f"{DEFAULT_API_URL}/companies/{comp_id}/cto/directive",
                json={"directive": directive, "priority": priority},
            )

        if res.status_code != 201:
            console.print(f"[bold red]Directive failed ({res.status_code}):[/bold red] {res.text}")
            return

        data = res.json()
        console.print(
            Panel(
                f"[bold green]Directive Accepted by CTO {data['cto_agent_name']}[/bold green]\n"
                f"[white]{data['analysis']}[/white]\n\n"
                f"[dim]Decomposed into {data['tasks_created_count']} tasks:[/dim]",
                border_style="green",
                box=box.ROUNDED,
            )
        )

        table = Table(box=box.SIMPLE, show_header=True, header_style="bold cyan")
        table.add_column("Task ID", style="dim", width=10)
        table.add_column("Title", style="bold white")
        table.add_column("Target Role", style="cyan")
        table.add_column("Assigned Agent", style="green")
        table.add_column("Dependencies", style="dim")

        for t in data["tasks"]:
            deps = ", ".join(t["dependencies"]) if t["dependencies"] else "None (Ready)"
            table.add_row(t["id"][:8], t["title"], t["role"].upper(), t["assigned_agent"], deps)

        console.print(table)
        console.print(
            "[dim]Run 'neiman-cli supervisor tick' to execute the next task in the lifecycle.[/dim]"
        )


async def cmd_proposals(company_id: str | None = None) -> None:
    """List proactive engineering and architectural proposals from the CTO."""
    async with get_http_client(timeout=10.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/cto/proposals")
        if res.status_code != 200:
            console.print(f"[bold red]Error fetching proposals:[/bold red] {res.text}")
            return

        props = res.json()
        if not props:
            console.print("[dim]No proposals currently formulated.[/dim]")
            return

        console.print(
            f"[bold cyan]CTO Proactive Initiatives Queue ({len(props)} Proposals):[/bold cyan]\n"
        )
        for p in props:
            badge_color = (
                "green"
                if p["status"] == "APPROVED"
                else "yellow"
                if p["status"] == "PROPOSED"
                else "dim"
            )
            panel_content = (
                f"[bold white]{p['title']}[/bold white]  [{badge_color}][{p['status']}][/{badge_color}]\n"
                f"[bold cyan]Category:[/bold cyan] {p['category']} | [dim]ID: {p['id']}[/dim]\n\n"
                f"[bold]Rationale:[/bold] {p['rationale']}\n"
                f"[bold green]Impact Assessment:[/bold green] {p['impact_assessment']}\n\n"
                f"[bold cyan]Proposed Delegated Tasks ({len(p.get('proposed_tasks', []))}):[/bold cyan]\n"
            )
            for pt in p.get("proposed_tasks", []):
                panel_content += f"  • [{pt.get('role', 'worker').upper()}] {pt.get('title')}: {pt.get('description', '')}\n"

            if p["status"] == "PROPOSED":
                panel_content += f"\n[dim]To approve: neiman-cli approve {p['id']}[/dim]"

            console.print(Panel(panel_content, border_style=badge_color, box=box.ROUNDED))


async def cmd_approve_proposal(proposal_id: str, company_id: str | None = None) -> None:
    """Approve a proactive CTO proposal and delegate tasks to workforce."""
    async with get_http_client(timeout=15.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        res = await client.post(
            f"{DEFAULT_API_URL}/companies/{comp_id}/cto/proposals/{proposal_id}/decide",
            json={"decision": "APPROVED", "notes": "Approved from neiman-cli operator console"},
        )
        if res.status_code != 200:
            console.print(
                f"[bold red]Error approving proposal ({res.status_code}):[/bold red] {res.text}"
            )
            return

        data = res.json()
        console.print(
            Panel(
                f"[bold green]Proposal Successfully Approved & Delegated[/bold green]\n"
                f"Title: {data['title']}\n"
                f"Delegated Tasks Count: {len(data.get('delegated_task_ids', []))}\n"
                f"Task IDs: {', '.join(data.get('delegated_task_ids', []))}",
                border_style="green",
                box=box.ROUNDED,
            )
        )


async def cmd_dismiss_proposal(proposal_id: str, company_id: str | None = None) -> None:
    """Dismiss a proposal without delegating."""
    async with get_http_client(timeout=10.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        res = await client.post(
            f"{DEFAULT_API_URL}/companies/{comp_id}/cto/proposals/{proposal_id}/decide",
            json={"decision": "DISMISSED", "notes": "Dismissed from neiman-cli operator console"},
        )
        if res.status_code != 200:
            console.print(f"[bold red]Error dismissing proposal:[/bold red] {res.text}")
            return

        console.print(f"[yellow]Proposal {proposal_id} dismissed.[/yellow]")


async def cmd_supervisor(action: str, company_id: str | None = None) -> None:
    """Control supervisor daemon: play, pause, tick, or status."""
    async with get_http_client(timeout=30.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        action_upper = action.upper()
        if action_upper in ("PLAY", "PAUSE"):
            res = await client.post(
                f"{DEFAULT_API_URL}/companies/{comp_id}/cto/supervisor/toggle",
                json={"action": action_upper},
            )
            if res.status_code == 200:
                data = res.json()
                color = "green" if data["is_running"] else "yellow"
                console.print(f"[bold {color}]Supervisor toggled to {data['state']}[/bold {color}]")
            else:
                console.print(f"[bold red]Toggle failed:[/bold red] {res.text}")

        elif action_upper == "TICK":
            with console.status("[bold cyan]Executing autonomous supervisor cycle...[/bold cyan]"):
                res = await client.post(
                    f"{DEFAULT_API_URL}/companies/{comp_id}/cto/supervisor/tick"
                )

            if res.status_code == 200:
                data = res.json()
                status_color = "green" if data["status"] == "SUCCESS" else "yellow"
                console.print(
                    f"[{status_color}]Cycle #{data['cycle']} Result: {data['status']}[/{status_color}]"
                )
                console.print(f"Message: {data['message']}")
                for task in data.get("executed_tasks", []):
                    console.print(
                        f"  • [bold white]{task['title']}[/bold white] executed by [green]{task['agent']}[/green] in {task['duration_ms']:.1f}ms ({task['steps']} steps)"
                    )
            else:
                console.print(f"[bold red]Tick failed:[/bold red] {res.text}")

        elif action_upper == "STATUS":
            res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/cto/supervisor/status")
            if res.status_code == 200:
                data = res.json()
                console.print(
                    Panel(
                        f"State: {data['state']} | Running: {data['is_running']} | Active Cycle: #{data['active_cycle']}\n"
                        f"Pending: {data['pending_tasks_count']} | In Progress: {data['in_progress_tasks_count']} | Completed: {data['completed_tasks_count']}",
                        border_style="cyan",
                        box=box.ROUNDED,
                    )
                )


async def cmd_swarm(company_id: str | None = None) -> None:
    """List all agents in the workforce swarm with roles, status, and tasks."""
    async with get_http_client(timeout=10.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/agents")
        if res.status_code != 200:
            console.print(f"[bold red]Error fetching swarm:[/bold red] {res.text}")
            return

        agents = res.json()
        table = Table(box=box.ROUNDED, show_header=True, header_style="bold cyan")
        table.add_column("Agent ID", style="dim", width=10)
        table.add_column("Agent Name", style="bold white")
        table.add_column("Status", justify="center")
        table.add_column("Autonomy", justify="center")
        table.add_column("Capabilities", style="dim")

        for a in agents:
            status_style = (
                "bold green"
                if a["status"] in ("WORKING", "ACTIVE")
                else "yellow"
                if a["status"] == "AVAILABLE"
                else "dim"
            )
            caps = ", ".join(a.get("capabilities", [])) if a.get("capabilities") else "None"
            table.add_row(
                a["id"][:8],
                a["name"],
                f"[{status_style}]{a['status']}[/{status_style}]",
                a.get("autonomy", "L3"),
                caps,
            )

        console.print(
            Panel(
                f"[bold cyan]NEIMAN Workforce Swarm ({len(agents)} Agents)[/bold cyan]",
                box=box.ROUNDED,
            )
        )
        console.print(table)


async def cmd_tasks(company_id: str | None = None) -> None:
    """List project tasks with priority, status, and assigned employee agent."""
    async with get_http_client(timeout=10.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        proj_res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/projects")
        if proj_res.status_code != 200 or not proj_res.json():
            console.print("[dim]No projects found.[/dim]")
            return

        projects = proj_res.json()
        agent_res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/agents")
        agents = agent_res.json() if agent_res.status_code == 200 else []
        agent_map = {str(a["id"]): a["name"] for a in agents}

        table = Table(box=box.ROUNDED, show_header=True, header_style="bold cyan")
        table.add_column("Task ID", style="dim", width=10)
        table.add_column("Title", style="bold white")
        table.add_column("Status", justify="center")
        table.add_column("Priority", justify="center")
        table.add_column("Assignee", style="bold green")
        table.add_column("Dependencies", style="dim")

        total_tasks = 0
        for p in projects:
            task_res = await client.get(
                f"{DEFAULT_API_URL}/companies/{comp_id}/projects/{p['id']}/tasks"
            )
            if task_res.status_code == 200:
                tasks = task_res.json()
                total_tasks += len(tasks)
                for t in tasks:
                    status_style = (
                        "bold green"
                        if t["status"] == "COMPLETED"
                        else "bold cyan"
                        if t["status"] == "IN_PROGRESS"
                        else "yellow"
                    )
                    deps = ", ".join(t.get("dependencies", [])) if t.get("dependencies") else "None"
                    assignee = agent_map.get(
                        str(t.get("assigned_agent_id")), "[dim]Unassigned[/dim]"
                    )
                    table.add_row(
                        t["id"][:8],
                        t["title"],
                        f"[{status_style}]{t['status']}[/{status_style}]",
                        t.get("priority", "MEDIUM"),
                        assignee,
                        deps,
                    )

        console.print(
            Panel(
                f"[bold cyan]Organizational Task Backlog ({total_tasks} Tasks)[/bold cyan]",
                box=box.ROUNDED,
            )
        )
        console.print(table)


# ── Project & Task Assignment Subsystem ──────────────────────────────────────


async def resolve_project(
    client: httpx.AsyncClient, comp_id: str, identifier: str
) -> dict[str, Any] | None:
    """Resolve project by UUID, prefix, or name substring."""
    res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/projects")
    if res.status_code != 200:
        return None
    projects = res.json()
    ident = identifier.strip().lower()
    for p in projects:
        if str(p["id"]).lower() == ident:
            return p
    for p in projects:
        if str(p["id"]).lower().startswith(ident):
            return p
    for p in projects:
        if ident in p["name"].lower():
            return p
    return None


async def resolve_agent(
    client: httpx.AsyncClient, comp_id: str, identifier: str
) -> dict[str, Any] | None:
    """Resolve agent by UUID, prefix, or name substring."""
    res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/agents")
    if res.status_code != 200:
        return None
    agents = res.json()
    ident = identifier.strip().lower()
    for a in agents:
        if str(a["id"]).lower() == ident:
            return a
    for a in agents:
        if str(a["id"]).lower().startswith(ident):
            return a
    for a in agents:
        if ident in a["name"].lower():
            return a
    return None


async def resolve_task(
    client: httpx.AsyncClient, comp_id: str, identifier: str
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Resolve task across projects by UUID, prefix, or title substring. Returns (task, project)."""
    proj_res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/projects")
    if proj_res.status_code != 200:
        return None
    projects = proj_res.json()
    ident = identifier.strip().lower()
    all_tasks: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for p in projects:
        task_res = await client.get(
            f"{DEFAULT_API_URL}/companies/{comp_id}/projects/{p['id']}/tasks"
        )
        if task_res.status_code == 200:
            for t in task_res.json():
                all_tasks.append((t, p))

    for t, p in all_tasks:
        if str(t["id"]).lower() == ident:
            return (t, p)
    for t, p in all_tasks:
        if str(t["id"]).lower().startswith(ident):
            return (t, p)
    for t, p in all_tasks:
        if ident in t["title"].lower():
            return (t, p)
    return None


async def cmd_project_list(company_id: str | None = None) -> None:
    """List all projects, status, priority, and task execution progress."""
    async with get_http_client(timeout=10.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/projects")
        if res.status_code != 200:
            console.print(
                f"[bold red]Error listing projects ({res.status_code}):[/bold red] {res.text}"
            )
            return

        projects = res.json()
        if not projects:
            console.print(
                "[dim]No projects exist. Create one with: neiman-cli project create <name>[/dim]"
            )
            return

        table = Table(box=box.ROUNDED, show_header=True, header_style="bold cyan")
        table.add_column("Project ID", style="dim", width=10)
        table.add_column("Project Name", style="bold white")
        table.add_column("Status", justify="center")
        table.add_column("Priority", justify="center")
        table.add_column("Tasks (Done/Total)", justify="center")
        table.add_column("Objective", style="dim")

        for p in projects:
            t_res = await client.get(
                f"{DEFAULT_API_URL}/companies/{comp_id}/projects/{p['id']}/tasks"
            )
            tasks = t_res.json() if t_res.status_code == 200 else []
            completed = sum(1 for t in tasks if t.get("status") == "COMPLETED")
            total = len(tasks)
            task_progress = f"{completed}/{total}"
            if total > 0 and completed == total:
                task_progress = f"[bold green]{task_progress}[/bold green]"

            st = p.get("status", "ACTIVE")
            st_style = "bold green" if st == "ACTIVE" else "yellow" if st == "PLANNING" else "dim"

            table.add_row(
                p["id"][:8],
                p["name"],
                f"[{st_style}]{st}[/{st_style}]",
                p.get("priority", "MEDIUM"),
                task_progress,
                p.get("objective") or "—",
            )

        console.print(
            Panel(
                f"[bold cyan]NEIMAN Projects Portfolio ({len(projects)} Projects)[/bold cyan]",
                box=box.ROUNDED,
            )
        )
        console.print(table)
        console.print(
            "[dim]Assign project: neiman-cli project assign <project> <agent> | List tasks: neiman-cli project tasks <project>[/dim]"
        )


async def cmd_project_create(
    name: str,
    objective: str | None = None,
    priority: str = "MEDIUM",
    company_id: str | None = None,
) -> None:
    """Create a new organizational project container."""
    async with get_http_client(timeout=10.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        payload = {
            "name": name.strip(),
            "objective": objective.strip()
            if objective
            else f"Autonomous engineering project: {name}",
            "priority": priority.upper()
            if priority.upper() in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
            else "MEDIUM",
        }

        res = await client.post(f"{DEFAULT_API_URL}/companies/{comp_id}/projects", json=payload)
        if res.status_code not in (200, 201):
            console.print(
                f"[bold red]Failed to create project ({res.status_code}):[/bold red] {res.text}"
            )
            return

        proj = res.json()
        console.print(
            Panel(
                f"[bold green][✓] Project Successfully Created[/bold green]\n"
                f"Project ID: [bold white]{proj['id']}[/bold white]\n"
                f"Name: [bold cyan]{proj['name']}[/bold cyan]\n"
                f"Priority: [yellow]{proj.get('priority', 'MEDIUM')}[/yellow] | Status: [green]{proj.get('status', 'ACTIVE')}[/green]\n"
                f"Objective: {proj.get('objective', '—')}",
                box=box.ROUNDED,
                border_style="green",
            )
        )


async def cmd_project_assign(
    project_identifier: str,
    agent_identifier: str,
    company_id: str | None = None,
) -> None:
    """Assign an entire project and its tasks to a specific agent in the workforce swarm."""
    async with get_http_client(timeout=15.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        project = await resolve_project(client, comp_id, project_identifier)
        if not project:
            console.print(f"[bold red]Error:[/bold red] Project '{project_identifier}' not found.")
            return

        agent = await resolve_agent(client, comp_id, agent_identifier)
        if not agent:
            console.print(
                f"[bold red]Error:[/bold red] Agent '{agent_identifier}' not found in workforce swarm."
            )
            return

        # Fetch tasks under project
        task_res = await client.get(
            f"{DEFAULT_API_URL}/companies/{comp_id}/projects/{project['id']}/tasks"
        )
        tasks = task_res.json() if task_res.status_code == 200 else []

        if not tasks:
            # Create a primary task for the project and assign to agent
            create_task_res = await client.post(
                f"{DEFAULT_API_URL}/companies/{comp_id}/projects/{project['id']}/tasks",
                json={
                    "title": f"Execute Core Deliverables: {project['name']}",
                    "description": f"Lead engineering execution and milestones for project: {project['name']}",
                    "assigned_agent_id": agent["id"],
                    "priority": project.get("priority", "MEDIUM"),
                },
            )
            if create_task_res.status_code in (200, 201):
                tasks = [create_task_res.json()]

        updated_count = 0
        assigned_tasks = []
        for t in tasks:
            patch_res = await client.patch(
                f"{DEFAULT_API_URL}/companies/{comp_id}/projects/{project['id']}/tasks/{t['id']}",
                json={"assigned_agent_id": agent["id"]},
            )
            if patch_res.status_code == 200:
                updated_count += 1
                assigned_tasks.append(patch_res.json())
            else:
                assigned_tasks.append(t)

        console.print(
            Panel(
                f"[bold green][✓] Project Assigned to Agent Employee[/bold green]\n"
                f"Project: [bold cyan]{project['name']}[/bold cyan] [dim]({project['id'][:8]})[/dim]\n"
                f"Assigned Lead: [bold white]{agent['name']}[/bold white] [dim]({agent['id'][:8]})[/dim]\n"
                f"Tasks Updated: [bold green]{updated_count}/{len(tasks)}[/bold green]",
                box=box.ROUNDED,
                border_style="green",
            )
        )

        if assigned_tasks:
            table = Table(box=box.SIMPLE, show_header=True, header_style="bold cyan")
            table.add_column("Task ID", style="dim", width=10)
            table.add_column("Title", style="bold white")
            table.add_column("Status", justify="center")
            table.add_column("Priority", justify="center")
            table.add_column("Assignee", style="bold green")

            for t in assigned_tasks:
                table.add_row(
                    t["id"][:8],
                    t["title"],
                    t["status"],
                    t.get("priority", "MEDIUM"),
                    agent["name"],
                )
            console.print(table)


async def cmd_project_tasks(project_identifier: str, company_id: str | None = None) -> None:
    """List tasks belonging to a specific project with assigned agent names."""
    async with get_http_client(timeout=10.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        project = await resolve_project(client, comp_id, project_identifier)
        if not project:
            console.print(f"[bold red]Error:[/bold red] Project '{project_identifier}' not found.")
            return

        task_res = await client.get(
            f"{DEFAULT_API_URL}/companies/{comp_id}/projects/{project['id']}/tasks"
        )
        if task_res.status_code != 200:
            console.print(f"[bold red]Error fetching tasks:[/bold red] {task_res.text}")
            return

        tasks = task_res.json()
        agent_res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/agents")
        agents = agent_res.json() if agent_res.status_code == 200 else []
        agent_map = {str(a["id"]): a["name"] for a in agents}

        table = Table(box=box.ROUNDED, show_header=True, header_style="bold cyan")
        table.add_column("Task ID", style="dim", width=10)
        table.add_column("Title", style="bold white")
        table.add_column("Status", justify="center")
        table.add_column("Priority", justify="center")
        table.add_column("Assignee", style="bold green")
        table.add_column("Dependencies", style="dim")

        for t in tasks:
            status_style = (
                "bold green"
                if t["status"] == "COMPLETED"
                else "bold cyan"
                if t["status"] == "IN_PROGRESS"
                else "yellow"
            )
            deps = ", ".join(t.get("dependencies", [])) if t.get("dependencies") else "None"
            assignee = agent_map.get(str(t.get("assigned_agent_id")), "[dim]Unassigned[/dim]")
            table.add_row(
                t["id"][:8],
                t["title"],
                f"[{status_style}]{t['status']}[/{status_style}]",
                t.get("priority", "MEDIUM"),
                assignee,
                deps,
            )

        console.print(
            Panel(
                f"[bold cyan]Tasks for Project: {project['name']}[/bold cyan] [dim]({len(tasks)} Tasks)[/dim]",
                box=box.ROUNDED,
            )
        )
        console.print(table)


async def cmd_task_assign(
    task_identifier: str,
    agent_identifier: str,
    company_id: str | None = None,
) -> None:
    """Assign an individual task to an agent employee."""
    async with get_http_client(timeout=10.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        match = await resolve_task(client, comp_id, task_identifier)
        if not match:
            console.print(f"[bold red]Error:[/bold red] Task '{task_identifier}' not found.")
            return

        task, project = match
        agent = await resolve_agent(client, comp_id, agent_identifier)
        if not agent:
            console.print(f"[bold red]Error:[/bold red] Agent '{agent_identifier}' not found.")
            return

        res = await client.patch(
            f"{DEFAULT_API_URL}/companies/{comp_id}/projects/{project['id']}/tasks/{task['id']}",
            json={"assigned_agent_id": str(agent["id"])},
        )
        if res.status_code != 200:
            console.print(
                f"[bold red]Failed to assign task ({res.status_code}):[/bold red] {res.text}"
            )
            return

        updated = res.json()
        console.print(
            Panel(
                f"[bold green][✓] Task Assigned Successfully[/bold green]\n"
                f"Task: [bold white]{updated['title']}[/bold white] [dim]({updated['id'][:8]})[/dim]\n"
                f"Project: [cyan]{project['name']}[/cyan]\n"
                f"Assigned Agent: [bold green]{agent['name']}[/bold green] [dim]({agent['id'][:8]})[/dim]\n"
                f"Status: [yellow]{updated['status']}[/yellow] | Priority: {updated.get('priority', 'MEDIUM')}",
                box=box.ROUNDED,
                border_style="green",
            )
        )


async def cmd_task_create(
    title: str,
    project_identifier: str | None = None,
    priority: str = "MEDIUM",
    company_id: str | None = None,
) -> None:
    """Create a new task under an engineering project."""
    async with get_http_client(timeout=10.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        proj_id = None
        proj_name = ""
        if project_identifier:
            proj = await resolve_project(client, comp_id, project_identifier)
            if not proj:
                console.print(f"[bold red]Error:[/bold red] Project '{project_identifier}' not found.")
                return
            proj_id = proj["id"]
            proj_name = proj["name"]
        else:
            p_res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/projects")
            if p_res.status_code == 200 and p_res.json():
                proj = p_res.json()[0]
                proj_id = proj["id"]
                proj_name = proj["name"]

        if not proj_id:
            console.print("[bold red]Error:[/bold red] No project found to create task in. Create one first using 'neiman-cli project create'.")
            return

        res = await client.post(
            f"{DEFAULT_API_URL}/companies/{comp_id}/projects/{proj_id}/tasks",
            json={"title": title, "priority": priority.upper()},
        )
        if res.status_code in (200, 201):
            t = res.json()
            console.print(
                Panel(
                    f"[bold green][✓] Task Created Successfully[/bold green]\n"
                    f"Title: [bold white]{t['title']}[/bold white] [dim]({t['id'][:8]})[/dim]\n"
                    f"Project: [cyan]{proj_name}[/cyan]\n"
                    f"Priority: [yellow]{t.get('priority', priority.upper())}[/yellow] | Status: [green]{t.get('status', 'PENDING')}[/green]",
                    box=box.ROUNDED,
                    border_style="green",
                )
            )
        else:
            console.print(f"[bold red]Failed to create task ({res.status_code}):[/bold red] {res.text}")


async def cmd_setup(
    company_id: str | None = None,
    blueprint: str = "software_development_company",
    company_name: str | None = None,
    provider: str | None = None,
    key: str | None = None,
    url: str | None = None,
    project_name: str | None = None,
    workspace_path: str | None = None,
    goal: str | None = None,
    priority: str = "HIGH",
    non_interactive: bool = False,
    auto_plan: bool = True,
) -> None:
    """Run interactive or batch setup wizard for blueprint, provider, workspace, and CTO roadmap."""
    console.print(
        Panel(
            Text.assemble(
                ("NEIMAN OS ", "bold cyan"),
                ("⚡ INTERACTIVE PROJECT SETUP & ONBOARDING WIZARD\n", "bold white"),
                ("Initialize enterprise archetype, configure AI intelligence, link codebase workspace, and formulate CTO roadmap.\n", "dim"),
            ),
            border_style="cyan",
            box=box.ROUNDED,
        )
    )

    async with get_http_client(timeout=30.0) as client:
        # Phase 1: Company / Enterprise Archetype
        comp_id = company_id or get_configured_company_id()
        existing_company = None
        if comp_id:
            try:
                c_res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}")
                if c_res.status_code == 200:
                    existing_company = c_res.json()
            except Exception:
                pass

        if not existing_company:
            try:
                comps_res = await client.get(f"{DEFAULT_API_URL}/companies")
                if comps_res.status_code == 200:
                    comps = comps_res.json()
                    if comps:
                        existing_company = comps[0]
                        comp_id = existing_company["id"]
            except Exception:
                pass

        if not existing_company:
            console.print("[bold yellow][Step 1/4] Organizational Archetype Blueprint[/bold yellow]")
            bp_choices = [
                ("software_development_company", "Neiman Autonomous Systems", "Autonomous Software Company (Hermes Agent / Full Workforce)"),
                ("cybersecurity_company", "Neiman Cyber Defense Swarm", "Cyber Defense Operation (Security Architecture Swarm)"),
                ("marketing_agency", "Neiman Rapid Delivery Agency", "Lean Agency Swarm (Rapid Prototyping & Delivery)"),
            ]
            chosen_bp = blueprint
            chosen_name = company_name or "Neiman Autonomous Systems"

            if not non_interactive:
                t = Table(box=box.SIMPLE)
                t.add_column("#", style="bold yellow")
                t.add_column("Archetype Blueprint", style="bold cyan")
                t.add_column("Capabilities & Workforce", style="dim")
                for idx, (b_slug, def_name, desc) in enumerate(bp_choices, 1):
                    t.add_row(str(idx), def_name, desc)
                console.print(t)

                try:
                    choice = input("\033[1;36mSelect blueprint [1-3, default=1]:\033[0m ").strip()
                    if choice in ("1", "2", "3"):
                        chosen_bp, default_name, _ = bp_choices[int(choice) - 1]
                        name_in = input(f"\033[1;36mCompany Name [default='{default_name}']:\033[0m ").strip()
                        chosen_name = name_in if name_in else default_name
                except (KeyboardInterrupt, EOFError):
                    console.print("\n[red]Setup cancelled.[/red]")
                    return

            console.print(f"[dim]Instantiating blueprint '{chosen_bp}' as '{chosen_name}'...[/dim]")
            inst_res = await client.post(
                f"{DEFAULT_API_URL}/blueprints/{chosen_bp}/instantiate",
                json={"company_name": chosen_name},
            )
            if inst_res.status_code not in (200, 201):
                console.print(f"[bold red]Failed to instantiate blueprint:[/bold red] {inst_res.text}")
                return
            inst_data = inst_res.json()
            comp_id = (
                inst_data.get("company_id")
                or inst_data.get("company", {}).get("id")
                or inst_data.get("id")
            )
            console.print(f"[bold green]✔ Enterprise initialized:[/bold green] {chosen_name} ([dim]{comp_id}[/dim])")
        else:
            comp_id = existing_company["id"]
            comp_name = existing_company.get("name", "Neiman Systems")
            console.print(f"[bold green]✔ Using existing active enterprise:[/bold green] {comp_name} ([dim]{comp_id}[/dim])")

        # Persist active company to config
        cfg = load_cli_config()
        cfg["company_id"] = comp_id
        save_cli_config(cfg)

        # Phase 2: AI Model Provider Configuration
        console.print("\n[bold yellow][Step 2/4] AI Model Provider & Credentials[/bold yellow]")
        env_keys = {
            "openai": os.environ.get("OPENAI_API_KEY"),
            "anthropic": os.environ.get("ANTHROPIC_API_KEY"),
            "gemini": os.environ.get("GEMINI_API_KEY"),
            "groq": os.environ.get("GROQ_API_KEY"),
            "openrouter": os.environ.get("OPENROUTER_API_KEY"),
        }

        chosen_provider = provider
        chosen_key = key
        chosen_url = url

        if not chosen_provider and not non_interactive:
            t = Table(box=box.SIMPLE)
            t.add_column("#", style="bold yellow")
            t.add_column("Provider", style="bold cyan")
            t.add_column("Environment Key", style="dim")
            t.add_column("Description", style="dim")

            prov_options = [
                ("auto", "Auto-detect Credentials (Recommended)", "Detected from environment", "Use existing active environment API keys"),
                ("openai", "OpenAI", "SET" if env_keys["openai"] else "MISSING", "GPT-4o, o1 reasoning models"),
                ("anthropic", "Anthropic", "SET" if env_keys["anthropic"] else "MISSING", "Claude 3.5 Sonnet / Haiku"),
                ("gemini", "Google Gemini", "SET" if env_keys["gemini"] else "MISSING", "Gemini 1.5 Pro / Flash"),
                ("openrouter", "OpenRouter / Groq", "SET" if env_keys["openrouter"] or env_keys["groq"] else "MISSING", "Open router endpoint"),
                ("local_ollama", "Local Ollama / vLLM", "READY", "Air-gapped local model on http://localhost:11434"),
            ]
            for idx, (_, name, env_st, desc) in enumerate(prov_options, 1):
                t.add_row(str(idx), name, env_st, desc)
            console.print(t)

            try:
                p_choice = input("\033[1;36mSelect provider [1-6, default=1]:\033[0m ").strip()
                if p_choice == "2":
                    chosen_provider = "openai"
                elif p_choice == "3":
                    chosen_provider = "anthropic"
                elif p_choice == "4":
                    chosen_provider = "gemini"
                elif p_choice == "5":
                    chosen_provider = "openrouter"
                elif p_choice == "6":
                    chosen_provider = "local_ollama"
                    chosen_url = "http://localhost:11434"
                else:
                    chosen_provider = "auto"
            except (KeyboardInterrupt, EOFError):
                console.print("\n[red]Setup cancelled.[/red]")
                return

        if chosen_provider == "auto" or not chosen_provider:
            for k, v in env_keys.items():
                if v:
                    chosen_provider = k
                    chosen_key = v
                    break
            if not chosen_provider:
                chosen_provider = "local_ollama"
                chosen_url = "http://localhost:11434"

        if chosen_provider in env_keys and not chosen_key:
            chosen_key = env_keys.get(chosen_provider)
            if not chosen_key and not non_interactive:
                try:
                    chosen_key = input(f"\033[1;36mEnter API Key for {chosen_provider}:\033[0m ").strip()
                except (KeyboardInterrupt, EOFError):
                    pass

        conf_body: dict[str, Any] = {"auto_discover": True}
        if chosen_key:
            conf_body["api_key"] = chosen_key
        if chosen_url:
            conf_body["base_url"] = chosen_url

        try:
            p_res = await client.post(
                f"{DEFAULT_API_URL}/companies/{comp_id}/intelligence/providers/{chosen_provider}/configure",
                json=conf_body,
            )
            if p_res.status_code == 200:
                console.print(f"[bold green]✔ Configured provider:[/bold green] {chosen_provider}")
                probe_res = await client.post(
                    f"{DEFAULT_API_URL}/companies/{comp_id}/intelligence/providers/{chosen_provider}/probe",
                    json={"timeout_seconds": 5.0},
                )
                if probe_res.status_code == 200:
                    pr = probe_res.json()
                    console.print(f"[dim]  Latency: {pr.get('latency_ms', 0):.1f}ms | Breaker: {pr.get('circuit_breaker_status')} | Healthy: {pr.get('is_healthy')}[/dim]")
            else:
                console.print(f"[dim]Provider configuration notice: {p_res.text}[/dim]")
        except Exception as e:
            console.print(f"[yellow]Warning configuring provider: {e}[/yellow]")

        # Phase 3: Project Setup & Codebase Linking
        console.print("\n[bold yellow][Step 3/4] Engineering Project & Codebase Linking[/bold yellow]")
        created_project_id = None
        inspection_result = None

        target_workspace = workspace_path
        if not target_workspace and not project_name and not non_interactive:
            cwd = os.getcwd()
            console.print("Choose project setup mode:")
            console.print(f"  [1] Scan & link current working folder ([cyan]{cwd}[/cyan])")
            console.print("  [2] Create blank custom engineering project")
            console.print("  [3] Retain blueprint's pre-seeded engineering projects")
            try:
                mode_choice = input("\033[1;36mSelect mode [1-3, default=1]:\033[0m ").strip()
            except (KeyboardInterrupt, EOFError):
                console.print("\n[red]Setup cancelled.[/red]")
                return

            if mode_choice == "2":
                try:
                    p_name_in = input("\033[1;36mProject Name [default='Custom Engineering Initiative']:\033[0m ").strip()
                    p_obj_in = input("\033[1;36mProject Objective:\033[0m ").strip()
                except (KeyboardInterrupt, EOFError):
                    return
                p_name = p_name_in or "Custom Engineering Initiative"
                p_obj = p_obj_in or "Custom engineering initiative"
                p_res = await client.post(
                    f"{DEFAULT_API_URL}/companies/{comp_id}/projects",
                    json={"name": p_name, "objective": p_obj, "priority": priority},
                )
                if p_res.status_code in (200, 201):
                    created_project_id = p_res.json().get("id")
                    console.print(f"[bold green]✔ Created project:[/bold green] {p_name} ([dim]{created_project_id}[/dim])")
            elif mode_choice == "3":
                p_list = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/projects")
                if p_list.status_code == 200 and p_list.json():
                    created_project_id = p_list.json()[0]["id"]
                    console.print(f"[bold green]✔ Retaining blueprint project:[/bold green] {p_list.json()[0]['name']}")
            else:
                target_workspace = cwd

        if target_workspace:
            target_path = os.path.abspath(target_workspace)
            console.print(f"[dim]Inspecting codebase at '{target_path}'...[/dim]")
            insp_res = await client.post(
                f"{DEFAULT_API_URL}/companies/{comp_id}/projects/inspect",
                json={"path": target_path},
            )
            if insp_res.status_code == 200:
                inspection_result = insp_res.json()
                t = Table(box=box.ROUNDED, title="Workspace Codebase Findings")
                t.add_column("Attribute", style="bold cyan")
                t.add_column("Inspected Value", style="white")
                t.add_row("Repository Name", inspection_result.get("project_name", "Unknown"))
                t.add_row("Primary Language", inspection_result.get("primary_language", "Unknown"))
                t.add_row("Frameworks", ", ".join(inspection_result.get("detected_frameworks", [])) or "None")
                t.add_row("Git Branch", f"{inspection_result.get('git_branch') or 'main'} ({inspection_result.get('git_commit', 'HEAD')})")
                t.add_row("Components", ", ".join(inspection_result.get("key_components", [])) or "None")
                t.add_row("Synopsis", inspection_result.get("summary", ""))
                console.print(t)

                proj_name = project_name or inspection_result.get("project_name") or "Linked Workspace Project"
                proj_obj = f"Autonomous development on {inspection_result.get('primary_language')} codebase"
                p_res = await client.post(
                    f"{DEFAULT_API_URL}/companies/{comp_id}/projects",
                    json={"name": proj_name, "objective": proj_obj, "priority": priority},
                )
                if p_res.status_code in (200, 201):
                    created_project_id = p_res.json().get("id")
                    console.print(f"[bold green]✔ Linked project created:[/bold green] {proj_name} ([dim]{created_project_id}[/dim])")
            else:
                console.print(f"[yellow]Workspace inspection warning:[/yellow] {insp_res.text}")
        elif project_name and not created_project_id:
            p_res = await client.post(
                f"{DEFAULT_API_URL}/companies/{comp_id}/projects",
                json={"name": project_name, "objective": "Custom initiative", "priority": priority},
            )
            if p_res.status_code in (200, 201):
                created_project_id = p_res.json().get("id")
                console.print(f"[bold green]✔ Created project:[/bold green] {project_name} ([dim]{created_project_id}[/dim])")

        if not created_project_id:
            p_list = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/projects")
            if p_list.status_code == 200 and p_list.json():
                created_project_id = p_list.json()[0]["id"]

        # Phase 4: CTO Roadmap Planning & Task DAG
        if auto_plan and created_project_id:
            console.print("\n[bold yellow][Step 4/4] CTO Roadmap Planning & Autonomous Task DAG[/bold yellow]")
            directive_text = goal
            if not directive_text:
                if inspection_result:
                    directive_text = (
                        f"Analyze repository at '{inspection_result.get('target_path')}' "
                        f"with language '{inspection_result.get('primary_language')}' "
                        f"and components {inspection_result.get('key_components')}. "
                        f"Formulate initial engineering roadmap and task backlog."
                    )
                elif not non_interactive:
                    console.print("[dim]Conducting brief /grill-me intake for autonomous CTO:[/dim]")
                    try:
                        q1 = input("\033[1;36m[1/3] What is the primary functional objective for this project?\033[0m ").strip()
                        q2 = input("\033[1;36m[2/3] Technical constraints, languages, or security gates?\033[0m ").strip()
                        q3 = input("\033[1;36m[3/3] Autonomy level [FULL / SUPERVISED, default=SUPERVISED]:\033[0m ").strip()
                        directive_text = f"Objective: {q1 or 'Build and deliver initiative'}. Constraints: {q2 or 'Strict type safety and quality standards'}. Governance: {q3 or 'SUPERVISED'}."
                    except (KeyboardInterrupt, EOFError):
                        directive_text = "Establish initial engineering architecture and core roadmap."
                else:
                    directive_text = "Establish initial engineering architecture and core roadmap."

            console.print(f"[dim]Dispatching directive to Autonomous CTO: '{directive_text}'...[/dim]")
            dir_res = await client.post(
                f"{DEFAULT_API_URL}/companies/{comp_id}/cto/directive",
                json={"directive": directive_text, "project_id": created_project_id},
            )
            if dir_res.status_code in (200, 201):
                dd = dir_res.json()
                tasks_created = dd.get("tasks", [])
                console.print(f"[bold green]✔ CTO Directive Accepted![/bold green] Analysis: {dd.get('analysis')}")
                if tasks_created:
                    t = Table(box=box.SIMPLE, title="CTO Formulated Task DAG")
                    t.add_column("Task ID", style="dim")
                    t.add_column("Title", style="bold cyan")
                    t.add_column("Priority", style="yellow")
                    t.add_column("Status", style="green")
                    for task in tasks_created:
                        t.add_row(
                            task.get("id", "")[:8],
                            task.get("title", ""),
                            task.get("priority", "HIGH"),
                            task.get("status", "PENDING"),
                        )
                    console.print(t)
            else:
                console.print(f"[yellow]CTO directive response:[/yellow] {dir_res.text}")

        # Summary Banner
        console.print(
            Panel(
                Text.assemble(
                    ("✔ SETUP COMPLETED SUCCESSFULLY\n\n", "bold green"),
                    ("• Active Enterprise  : ", "bold cyan"), (f"{comp_id}\n", "white"),
                    ("• Model Provider    : ", "bold cyan"), (f"{chosen_provider}\n", "white"),
                    ("• Primary Project   : ", "bold cyan"), (f"{created_project_id or 'Initialized'}\n\n", "white"),
                    ("Next steps:\n", "bold yellow"),
                    ("  • Launch TUI operator console     : ", "dim"), ("neiman-cli tui\n", "bold cyan"),
                    ("  • Launch Hermes interactive agent : ", "dim"), ("neiman-cli hermes\n", "bold cyan"),
                    ("  • Stream live telemetry           : ", "dim"), ("neiman-cli watch\n", "bold cyan"),
                ),
                border_style="green",
                box=box.ROUNDED,
            )
        )

        setup_flag = os.path.expanduser("~/.local/share/neiman/.setup_required")
        if os.path.exists(setup_flag):
            try:
                os.remove(setup_flag)
            except Exception:
                pass


# ── Hermes Agent Interactive Operator Console ────────────────────────────────


def _render_hermes_help() -> None:
    """Render Hermes interactive slash commands and usage guide."""
    table = Table(box=box.ROUNDED, show_header=True, header_style="bold cyan")
    table.add_column("Command / Input", style="bold white", width=34)
    table.add_column("Description", style="white")

    table.add_row(
        "<Any text directive>",
        "Autonomous CTO directive intake; decomposes & delegates across swarm",
    )
    table.add_row("/setup", "Launch interactive enterprise & codebase setup wizard")
    table.add_row(
        "/grill-me", "Run 3-question requirement interview to define project constraints"
    )
    table.add_row(
        "/plan [goal]", "Autonomous CTO roadmap planning & task DAG generation"
    )
    table.add_row("/project list", "List all organizational projects and completion progress")
    table.add_row("/project create <name>", "Create a new project container")
    table.add_row(
        "/project assign <proj> <agent>", "Batch assign project and all tasks to a swarm agent"
    )
    table.add_row("/project tasks <proj>", "List tasks belonging to a specific project")
    table.add_row("/task create <title>", "Create a new engineering task in active project")
    table.add_row("/assign <task_id> <agent>", "Assign an individual task to a specific agent")
    table.add_row("/tasks", "List complete organizational task backlog")
    table.add_row("/swarm", "Inspect active workforce agents, roles, and autonomy levels")
    table.add_row(
        "/supervisor [tick|play|pause]", "Trigger or control autonomous development cycle"
    )
    table.add_row(
        "/proposals [approve|dismiss]", "Inspect or approve proactive CTO architectural initiatives"
    )
    table.add_row(
        "/probe <provider>", "Test AI model provider latency, health, and circuit breaker"
    )
    table.add_row("/config", "Display CLI configuration, providers, and routing policy")
    table.add_row("/status", "Display full company status and supervisor metrics")
    table.add_row("/watch", "Stream live real-time telemetry waterfall")
    table.add_row("/clear", "Clear terminal screen")
    table.add_row("/tui", "Launch native Rust / Ratatui full-screen command center")
    table.add_row("/exit, /quit", "Exit Hermes interactive console")

    console.print(
        Panel(table, title="[bold cyan]Hermes Agent Operator Guide[/bold cyan]", box=box.ROUNDED)
    )


async def cmd_hermes_agent(company_id: str | None = None) -> None:
    """Launch Hermes Agent-style interactive operator console."""
    try:
        import readline  # noqa: F401
    except ImportError:
        pass

    async with get_http_client(timeout=15.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print(
                "[bold red]Error:[/bold red] Could not connect to NEIMAN API or no company exists."
            )
            return

        # Fetch status for banner
        cto_name = "CTO Agent"
        total_agents = 0
        sup_state = "IDLE"
        try:
            c_res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/cto/status")
            if c_res.status_code == 200:
                cd = c_res.json()
                cto_name = cd.get("cto_agent_name", "CTO")
                total_agents = cd.get("total_agents", 0)
            s_res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/cto/supervisor/status")
            if s_res.status_code == 200:
                sup_state = s_res.json().get("state", "IDLE")
        except Exception:
            pass

        banner = Text()
        banner.append("NEIMAN OS ", style="bold cyan")
        banner.append("⚡ HERMES AGENT INTERACTIVE CONSOLE\n", style="bold white")
        banner.append(
            f"Company ID: {comp_id[:8]}... | CTO: {cto_name} | Swarm: {total_agents} Agents | Supervisor: [{sup_state}]\n",
            style="dim",
        )
        banner.append("Commands: ", style="bold cyan")
        banner.append(
            "/help, /project, /assign, /tasks, /swarm, /supervisor, /status, /clear, /exit\n",
            style="yellow",
        )
        banner.append("Directive: ", style="bold green")
        banner.append(
            "Type any high-level engineering goal to autonomously decompose and assign across swarm.",
            style="dim",
        )

        console.print(Panel(banner, border_style="cyan", box=box.ROUNDED))

        while True:
            try:
                line = input("\033[1;36mhermes\033[0m \033[1;32m❯\033[0m ").strip()
            except (KeyboardInterrupt, EOFError):
                console.print("\n[dim]Hermes session ended.[/dim]")
                break

            if not line:
                continue

            if line.lower() in ("/exit", "/quit", "exit", "quit"):
                console.print("[dim]Exiting Hermes console.[/dim]")
                break

            if line.lower() == "/clear":
                os.system("clear")
                continue

            if line.lower() == "/help":
                _render_hermes_help()
                continue

            if line.lower() == "/status":
                await cmd_status(comp_id)
                continue

            if line.lower() == "/swarm":
                await cmd_swarm(comp_id)
                continue

            if line.lower() == "/watch":
                await cmd_watch(comp_id)
                continue

            if line.lower() == "/tui":
                cmd_launch_tui()
                continue

            if line.startswith("/tasks"):
                await cmd_tasks(comp_id)
                continue

            if line.startswith("/project"):
                parts = shlex.split(line)
                sub = parts[1].lower() if len(parts) > 1 else "list"
                if sub == "list":
                    await cmd_project_list(comp_id)
                elif sub in ("create", "new"):
                    if len(parts) < 3:
                        console.print(
                            "[yellow]Usage: /project create <name> [--objective <obj>] [--priority <priority>][/yellow]"
                        )
                    else:
                        name = parts[2]
                        obj = parts[3] if len(parts) > 3 and not parts[3].startswith("-") else None
                        await cmd_project_create(name, objective=obj, company_id=comp_id)
                elif sub == "assign":
                    if len(parts) < 4:
                        console.print("[yellow]Usage: /project assign <project> <agent>[/yellow]")
                    else:
                        await cmd_project_assign(parts[2], parts[3], comp_id)
                elif sub == "tasks":
                    if len(parts) < 3:
                        console.print("[yellow]Usage: /project tasks <project>[/yellow]")
                    else:
                        await cmd_project_tasks(parts[2], comp_id)
                else:
                    console.print(
                        f"[yellow]Unknown project subcommand '{sub}'. Use: list, create, assign, tasks[/yellow]"
                    )
                continue

            if line.startswith("/assign"):
                parts = shlex.split(line)
                if len(parts) < 3:
                    console.print("[yellow]Usage: /assign <task_id> <agent_name_or_id>[/yellow]")
                else:
                    await cmd_task_assign(parts[1], parts[2], comp_id)
                continue

            if line.startswith("/supervisor"):
                parts = shlex.split(line)
                action = parts[1].lower() if len(parts) > 1 else "status"
                if action in ("play", "pause", "tick", "status"):
                    await cmd_supervisor(action, comp_id)
                else:
                    console.print("[yellow]Usage: /supervisor [play|pause|tick|status][/yellow]")
                continue

            if line.startswith("/proposals"):
                parts = shlex.split(line)
                if len(parts) > 2 and parts[1].lower() == "approve":
                    await cmd_approve_proposal(parts[2], comp_id)
                elif len(parts) > 2 and parts[1].lower() == "dismiss":
                    await cmd_dismiss_proposal(parts[2], comp_id)
                else:
                    await cmd_proposals(comp_id)
                continue

            if line.startswith("/probe"):
                parts = shlex.split(line)
                provider = parts[1] if len(parts) > 1 else "openai"
                await cmd_config_probe(provider, company_id=comp_id)
                continue

            if line.startswith("/directive "):
                goal = line[11:].strip()
                if goal:
                    console.print(
                        f"[bold cyan][*] Dispatching directive to CTO {cto_name}...[/bold cyan]"
                    )
                    await cmd_directive(goal, company_id=comp_id)
                continue

            if line.startswith("/setup"):
                await cmd_setup(comp_id)
                continue

            if line.startswith("/grill-me"):
                console.print(
                    Panel(
                        "[bold cyan]⚡ Autonomous CTO Requirement Interview (/grill-me)[/bold cyan]\n"
                        "[dim]Aligning on project objectives, technical constraints, and autonomy boundaries.[/dim]",
                        box=box.ROUNDED,
                        border_style="cyan",
                    )
                )
                try:
                    q1 = input("\033[1;36m[1/3] What is the primary functional objective or deliverable?\033[0m ").strip()
                    q2 = input("\033[1;36m[2/3] What are the technical constraints, language requirements, or forbidden libraries?\033[0m ").strip()
                    q3 = input("\033[1;36m[3/3] Autonomy boundary preference [FULL / SEMI / SUPERVISED, default=SUPERVISED]:\033[0m ").strip()
                except (KeyboardInterrupt, EOFError):
                    continue
                directive_text = (
                    f"Initiative Requirement Specs — Objective: {q1 or 'Core system functionality'}. "
                    f"Constraints: {q2 or 'Strict type safety and zero-mock integrity'}. "
                    f"Governance Gate: {q3 or 'SUPERVISED'}."
                )
                console.print(f"[bold cyan][*] Submitting synthesized requirements to CTO {cto_name}...[/bold cyan]")
                await cmd_directive(directive_text, company_id=comp_id)
                continue

            if line.startswith("/plan"):
                parts = shlex.split(line)
                custom_plan_goal = " ".join(parts[1:]) if len(parts) > 1 else ""
                if not custom_plan_goal:
                    try:
                        custom_plan_goal = input("\033[1;36mEnter roadmap planning directive for CTO [default: 'Analyze codebase and formulate next sprint roadmap']:\033[0m ").strip()
                    except (KeyboardInterrupt, EOFError):
                        continue
                if not custom_plan_goal:
                    custom_plan_goal = "Analyze codebase and formulate next sprint roadmap."
                console.print(f"[bold cyan][*] CTO {cto_name} formulating /plan task DAG...[/bold cyan]")
                await cmd_directive(custom_plan_goal, company_id=comp_id)
                continue

            if line.startswith("/config"):
                await cmd_config_show(comp_id)
                continue

            if line.startswith("/task"):
                parts = shlex.split(line)
                sub = parts[1].lower() if len(parts) > 1 else "list"
                if sub in ("create", "new", "add"):
                    if len(parts) < 3:
                        console.print("[yellow]Usage: /task create <title> [--priority <priority>][/yellow]")
                    else:
                        title = parts[2]
                        await cmd_task_create(title, company_id=comp_id)
                else:
                    await cmd_tasks(comp_id)
                continue

            # Default: Direct Natural Language Autonomous Directive Intake
            console.print(
                f"[bold cyan][*] Autonomous CTO {cto_name} analyzing directive...[/bold cyan]"
            )
            await cmd_directive(line, company_id=comp_id)


async def cmd_watch(company_id: str | None = None) -> None:
    """Continuously stream live organizational operations and supervisor telemetry."""
    from rich.layout import Layout
    from rich.live import Live

    async with get_http_client(timeout=10.0) as client:
        comp_id = company_id or await get_active_company_id(client)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] Could not connect to NEIMAN API.")
            return

        with Live(console=console, screen=True, auto_refresh=False) as live:
            try:
                while True:
                    cto_res = await client.get(f"{DEFAULT_API_URL}/companies/{comp_id}/cto/status")
                    sup_res = await client.get(
                        f"{DEFAULT_API_URL}/companies/{comp_id}/cto/supervisor/status"
                    )
                    if cto_res.status_code == 200 and sup_res.status_code == 200:
                        cto_data = cto_res.json()
                        sup_data = sup_res.json()

                        layout = Layout()
                        layout.split_column(
                            Layout(name="header", size=5),
                            Layout(name="body", ratio=1),
                            Layout(name="footer", size=3),
                        )

                        status_color = "green" if sup_data["is_running"] else "yellow"
                        header_panel = Panel(
                            f"[bold cyan]NEIMAN OS // AUTONOMOUS CTO OPERATIONS[/bold cyan]\n"
                            f"CTO: [bold white]{cto_data['cto_agent_name']}[/bold white] | Workforce: {cto_data['working_agents']}/{cto_data['total_agents']} active\n"
                            f"Supervisor: [bold {status_color}][{sup_data['state']}][/bold {status_color}] Cycle #{sup_data['active_cycle']} | "
                            f"Pending: {sup_data['pending_tasks_count']} | Active: {sup_data['in_progress_tasks_count']} | Done: {sup_data['completed_tasks_count']}",
                            border_style="cyan",
                            box=box.ROUNDED,
                        )
                        layout["header"].update(header_panel)

                        events_table = Table(
                            box=box.SIMPLE, show_header=True, header_style="bold cyan"
                        )
                        events_table.add_column("Timestamp", style="dim", width=20)
                        events_table.add_column("Type", style="bold yellow", width=16)
                        events_table.add_column("Telemetry Event", style="white")

                        for ev in sup_data.get("recent_events", [])[:12]:
                            events_table.add_row(
                                ev.get("timestamp", "")[:19],
                                ev.get("event_type", ""),
                                ev.get("message", ""),
                            )

                        layout["body"].update(
                            Panel(
                                events_table, title="Live Telemetry Waterfall", border_style="cyan"
                            )
                        )
                        layout["footer"].update(
                            Panel(
                                "[dim]Watching live telemetry stream. Press Ctrl+C to exit.[/dim]",
                                box=box.ROUNDED,
                            )
                        )

                        live.update(layout, refresh=True)
                    await asyncio.sleep(1.5)
            except KeyboardInterrupt:
                pass


# ── Configuration Subsystem ──────────────────────────────────────────────────


async def cmd_config_show(company_id: str | None = None) -> None:
    """Display persistent CLI configuration, connection health, and active company context."""
    load_cli_config()
    api_url = get_configured_api_url()
    timeout = get_configured_timeout()
    token = get_configured_token()
    cfg_comp_id = get_configured_company_id()

    token_display = (
        f"{token[:6]}...{token[-4:]}"
        if token and len(token) > 10
        else ("Set" if token else "None (DISABLE_AUTH=true active)")
    )

    online = False
    latency_ms = 0.0
    health_info = "OFFLINE"
    base_url = api_url.split("/api")[0]
    t0 = time.perf_counter()
    async with get_http_client(timeout=3.0) as client:
        try:
            res = await client.get(f"{base_url}/health")
            latency_ms = (time.perf_counter() - t0) * 1000
            if res.status_code == 200:
                online = True
                health_info = f"ONLINE ({latency_ms:.1f}ms)"
            else:
                health_info = f"DEGRADED ({res.status_code})"
        except Exception as e:
            health_info = f"UNREACHABLE ({type(e).__name__})"

    cfg_exists = os.path.exists(CONFIG_FILE)
    panel_text = (
        f"[bold cyan]NEIMAN CLI // CONFIGURATION & TELEMETRY[/bold cyan]\n"
        f"Config File: [white]{CONFIG_FILE}[/white] ({'Present' if cfg_exists else 'Not created yet'})\n"
        f"API Base URL: [bold white]{api_url}[/bold white]\n"
        f"Auth Token: [white]{token_display}[/white]\n"
        f"Default Timeout: [white]{timeout:.1f}s[/white]\n"
        f"Backend Health: [{'bold green' if online else 'bold red'}]{health_info}[/{'bold green' if online else 'bold red'}]\n"
    )

    if online:
        async with get_http_client() as client:
            resolved_comp_id = (
                company_id or cfg_comp_id or await get_active_company_id(client, api_url)
            )
            if resolved_comp_id:
                try:
                    c_res = await client.get(f"{api_url}/companies/{resolved_comp_id}")
                    c_name = (
                        c_res.json().get("name", "Unknown")
                        if c_res.status_code == 200
                        else "Unknown"
                    )
                    panel_text += f"Active Company: [bold green]{c_name}[/bold green] [dim]({resolved_comp_id})[/dim]\n"
                except Exception:
                    panel_text += (
                        f"Active Company ID: [bold green]{resolved_comp_id}[/bold green]\n"
                    )

                try:
                    cto_res = await client.get(f"{api_url}/companies/{resolved_comp_id}/cto/status")
                    if cto_res.status_code == 200:
                        cto_data = cto_res.json()
                        panel_text += f"CTO Agent: [bold cyan]{cto_data.get('cto_agent_name')}[/bold cyan] | Workforce: {cto_data.get('working_agents')}/{cto_data.get('total_agents')} active\n"
                except Exception:
                    pass

    console.print(Panel(panel_text.strip(), border_style="cyan", box=box.ROUNDED))


def cmd_config_set(key: str, value: str) -> None:
    """Update a persistent CLI configuration setting."""
    valid_keys = {"api_url", "company_id", "token", "timeout"}
    k = key.lower().strip()
    if k not in valid_keys:
        console.print(
            f"[bold red]Error:[/bold red] Unknown key '{key}'. Valid keys are: {', '.join(sorted(valid_keys))}"
        )
        return

    v: Any = value.strip()
    if k == "api_url":
        if not (v.startswith("http://") or v.startswith("https://")):
            console.print("[bold red]Error:[/bold red] api_url must begin with http:// or https://")
            return
    elif k == "company_id":
        try:
            uuid.UUID(v)
        except ValueError:
            console.print("[bold red]Error:[/bold red] company_id must be a valid UUID string")
            return
    elif k == "timeout":
        try:
            v_float = float(v)
            if v_float <= 0:
                raise ValueError()
            v = v_float
        except ValueError:
            console.print(
                "[bold red]Error:[/bold red] timeout must be a positive number of seconds"
            )
            return

    cfg = load_cli_config()
    cfg[k] = v
    save_cli_config(cfg)

    display_v = f"{str(v)[:6]}...{str(v)[-4:]}" if k == "token" and len(str(v)) > 10 else str(v)
    console.print(
        f"[bold green][✓] Configuration key '{k}' saved:[/bold green] [white]{display_v}[/white]"
    )
    console.print(f"[dim]Persisted to {CONFIG_FILE}[/dim]")


def cmd_config_get(key: str | None = None) -> None:
    """Read persistent CLI configuration setting(s)."""
    cfg = load_cli_config()
    if key and key.lower() != "all":
        k = key.lower().strip()
        val = cfg.get(k)
        if val is None:
            console.print(f"[dim]{k} is not set in persistent config.[/dim]")
        else:
            display_v = (
                f"{str(val)[:6]}...{str(val)[-4:]}"
                if k == "token" and len(str(val)) > 10
                else str(val)
            )
            console.print(f"[bold cyan]{k}:[/bold cyan] {display_v}")
        return

    table = Table(box=box.ROUNDED, show_header=True, header_style="bold cyan")
    table.add_column("Key", style="bold white")
    table.add_column("Persisted Value", style="white")
    table.add_column("Effective Active Value", style="green")

    keys = ["api_url", "company_id", "token", "timeout"]
    for k in keys:
        raw_val = cfg.get(k)
        if k == "api_url":
            eff = get_configured_api_url()
        elif k == "company_id":
            eff = get_configured_company_id() or "<auto-resolve>"
        elif k == "token":
            eff = get_configured_token() or "<none>"
        elif k == "timeout":
            eff = f"{get_configured_timeout()}s"
        else:
            eff = str(raw_val)

        p_display = (
            "<not set>"
            if raw_val is None
            else (f"{str(raw_val)[:6]}..." if k == "token" else str(raw_val))
        )
        e_display = f"{str(eff)[:6]}..." if k == "token" and eff != "<none>" else str(eff)
        table.add_row(k, p_display, e_display)

    console.print(
        Panel(table, title=f"NEIMAN CLI Configuration ({CONFIG_FILE})", border_style="cyan")
    )


async def cmd_config_providers(company_id: str | None = None) -> None:
    """List registered intelligence model providers, vault key status, and active models."""
    api_url = get_configured_api_url()
    async with get_http_client() as client:
        comp_id = company_id or await get_active_company_id(client, api_url)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        res = await client.get(f"{api_url}/companies/{comp_id}/intelligence/providers")
        if res.status_code != 200:
            console.print(
                f"[bold red]Error fetching providers ({res.status_code}):[/bold red] {res.text}"
            )
            return

        providers = res.json()
        models_res = await client.get(f"{api_url}/companies/{comp_id}/intelligence/models")
        models = models_res.json() if models_res.status_code == 200 else []

        model_counts: dict[str, int] = {}
        for m in models:
            pid = m.get("provider_id")
            if pid:
                model_counts[pid] = model_counts.get(pid, 0) + 1

        table = Table(box=box.ROUNDED, show_header=True, header_style="bold cyan")
        table.add_column("Provider", style="bold white")
        table.add_column("Display Name", style="white")
        table.add_column("Vault Key", justify="center")
        table.add_column("Status", justify="center")
        table.add_column("Models", justify="center")
        table.add_column("Endpoint Base URL", style="dim")

        for p in providers:
            p_name = p.get("name") or p.get("provider_name", "")
            disp_name = p.get("display_name", p_name)
            is_cfg = p.get("is_configured", False)
            masked = p.get("api_key_masked")
            key_status = (
                f"[bold green]{masked}[/bold green]"
                if (is_cfg and masked)
                else (
                    "[bold green]Configured[/bold green]" if is_cfg else "[yellow]No Key[/yellow]"
                )
            )
            is_healthy = p.get("is_healthy", True)
            health_badge = (
                "[bold green]HEALTHY (CLOSED)[/bold green]"
                if is_healthy
                else "[bold red]DEGRADED (OPEN)[/bold red]"
            )
            m_count = model_counts.get(p.get("id", ""), 0)
            base_url = p.get("base_url") or "<vendor default>"

            table.add_row(p_name, disp_name, key_status, health_badge, str(m_count), base_url)

        console.print(
            Panel(
                table,
                title=f"Registered Intelligence Providers ({len(providers)} Vendors | {len(models)} Models)",
                border_style="cyan",
            )
        )
        console.print(
            "[dim]Set an API key: neiman-cli config set-key <provider> <api_key> [--url <url>][/dim]"
        )
        console.print("[dim]Probe provider: neiman-cli config probe <provider>[/dim]")


async def cmd_config_set_key(
    provider: str,
    api_key: str,
    base_url: str | None = None,
    auto_discover: bool = True,
    company_id: str | None = None,
) -> None:
    """Store an encrypted AI provider API key in the backend vault and discover models."""
    api_url = get_configured_api_url()
    async with get_http_client() as client:
        comp_id = company_id or await get_active_company_id(client, api_url)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        with console.status(
            f"[bold cyan]Encrypting and configuring provider '{provider}'...[/bold cyan]"
        ):
            payload: dict[str, Any] = {
                "api_key": api_key,
                "auto_discover": auto_discover,
            }
            if base_url:
                payload["base_url"] = base_url

            res = await client.post(
                f"{api_url}/companies/{comp_id}/intelligence/providers/{provider}/configure",
                json=payload,
            )

        if res.status_code != 200:
            console.print(
                f"[bold red]Configuration failed ({res.status_code}):[/bold red] {res.text}"
            )
            return

        data = res.json()
        panel_content = (
            f"[bold green][✓] Provider '{data.get('provider_name')}' Successfully Configured[/bold green]\n"
            f"Display Name: [white]{data.get('display_name')}[/white]\n"
            f"Vault Secret: [bold green]{data.get('api_key_masked')}[/bold green] (Encrypted AES-256-GCM)\n"
            f"Base URL: [dim]{data.get('base_url') or '<vendor default>'}[/dim]\n"
            f"Discovered Models: [bold cyan]{data.get('discovered_models_count', 0)} registered[/bold cyan]\n"
        )
        if data.get("models"):
            panel_content += "\n[bold white]Registered Models Catalog:[/bold white]\n"
            for m in data["models"][:10]:
                panel_content += f"  • [cyan]{m}[/cyan]\n"
            if len(data["models"]) > 10:
                panel_content += f"  [dim]...and {len(data['models']) - 10} more[/dim]\n"

        console.print(Panel(panel_content.strip(), border_style="green", box=box.ROUNDED))
        try:
            cfg = load_cli_config()
            overrides = set(cfg.get("provider_overrides", []))
            overrides.add(provider)
            cfg["provider_overrides"] = sorted(list(overrides))
            save_cli_config(cfg)
        except Exception:
            pass


async def cmd_config_probe(
    provider: str,
    simulate: str | None = None,
    timeout: float = 10.0,
    company_id: str | None = None,
) -> None:
    """Probe vendor endpoint latency, health check, and circuit breaker status."""
    api_url = get_configured_api_url()
    async with get_http_client() as client:
        comp_id = company_id or await get_active_company_id(client, api_url)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        with console.status(f"[bold cyan]Probing provider '{provider}'...[/bold cyan]"):
            res = await client.post(
                f"{api_url}/companies/{comp_id}/intelligence/providers/{provider}/probe",
                json={"simulate_error": simulate, "timeout_seconds": timeout},
            )

        if res.status_code != 200:
            console.print(f"[bold red]Probe failed ({res.status_code}):[/bold red] {res.text}")
            return

        data = res.json()
        latency = data.get("latency_ms", 0.0)
        lat_color = "green" if latency < 600 else "yellow" if latency < 1500 else "red"
        cb_status = data.get("circuit_breaker_status", "UNKNOWN")
        cb_color = "green" if cb_status == "CLOSED" else "red"
        is_healthy = data.get("is_healthy", True)

        content = (
            f"Provider: [bold white]{data.get('display_name', provider)}[/bold white]\n"
            f"Health: [{'bold green' if is_healthy else 'bold red'}]{'HEALTHY' if is_healthy else 'FAILED'}[/{'bold green' if is_healthy else 'bold red'}]\n"
            f"Latency: [{lat_color}]{latency:.1f} ms[/{lat_color}]\n"
            f"Circuit Breaker: [{cb_color}]{cb_status}[/{cb_color}] (Consecutive Failures: {data.get('consecutive_failures', 0)})\n"
            f"Message: {data.get('message', '')}"
        )
        console.print(
            Panel(
                content,
                title=f"Provider Probe Telemetry: {provider}",
                border_style=cb_color,
                box=box.ROUNDED,
            )
        )


async def cmd_config_reset_breakers(company_id: str | None = None) -> None:
    """Reset all circuit breakers to CLOSED and restore provider health."""
    api_url = get_configured_api_url()
    async with get_http_client() as client:
        comp_id = company_id or await get_active_company_id(client, api_url)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        res = await client.post(
            f"{api_url}/companies/{comp_id}/intelligence/circuit-breakers/reset"
        )
        if res.status_code == 200:
            console.print(
                "[bold green][✓] All provider circuit breakers reset to CLOSED and marked healthy.[/bold green]"
            )
        else:
            console.print(f"[bold red]Reset failed ({res.status_code}):[/bold red] {res.text}")


async def cmd_config_sync_models(company_id: str | None = None) -> None:
    """Sync available models from all configured provider API keys dynamically."""
    api_url = get_configured_api_url()
    async with get_http_client() as client:
        comp_id = company_id or await get_active_company_id(client, api_url)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        with console.status("[bold cyan]Syncing models from configured provider API keys...[/bold cyan]"):
            res = await client.post(
                f"{api_url}/companies/{comp_id}/intelligence/providers/sync-models"
            )

        if res.status_code == 200:
            data = res.json()
            console.print("[bold green][✓] Model Provider Sync Complete[/bold green]")
            table = Table(box=box.ROUNDED)
            table.add_column("Provider", style="cyan")
            table.add_column("Discovered", style="magenta")
            table.add_column("Added", style="green")
            table.add_column("Deactivated", style="yellow")
            table.add_column("Active Total", style="white")

            for item in data.get("synced_providers", []):
                table.add_row(
                    item.get("display_name", item.get("provider_name")),
                    str(item.get("discovered_count", 0)),
                    str(item.get("added_count", 0)),
                    str(item.get("deactivated_count", 0)),
                    str(item.get("active_models_count", 0)),
                )
            console.print(table)
            console.print(
                f"[dim]Total Active: {data.get('total_models_active')} | Added: {data.get('total_models_added')} | Soft-Deactivated: {data.get('total_models_soft_deactivated')}[/dim]"
            )
        else:
            console.print(f"[bold red]Sync failed ({res.status_code}):[/bold red] {res.text}")


async def cmd_config_routing(
    strategy: str | None = None,
    max_cost: float | None = None,
    max_latency: float | None = None,
    fallback: str | None = None,
    company_id: str | None = None,
) -> None:
    """Inspect or update the model routing policy and fallback chain."""
    api_url = get_configured_api_url()
    async with get_http_client() as client:
        comp_id = company_id or await get_active_company_id(client, api_url)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        if any(x is not None for x in (strategy, max_cost, max_latency, fallback)):
            update_payload: dict[str, Any] = {}
            if strategy:
                update_payload["strategy"] = strategy.upper()
            if max_cost is not None:
                update_payload["max_cost_per_query_usd"] = max_cost
            if max_latency is not None:
                update_payload["max_acceptable_latency_ms"] = max_latency
            if fallback:
                update_payload["fallback_chain"] = [
                    m.strip() for m in fallback.split(",") if m.strip()
                ]

            res = await client.put(
                f"{api_url}/companies/{comp_id}/intelligence/policy", json=update_payload
            )
            if res.status_code != 200:
                console.print(
                    f"[bold red]Policy update failed ({res.status_code}):[/bold red] {res.text}"
                )
                return
            console.print("[bold green][✓] Routing policy successfully updated.[/bold green]")
        else:
            res = await client.get(f"{api_url}/companies/{comp_id}/intelligence/policy")
            if res.status_code != 200:
                console.print(
                    f"[bold red]Failed fetching policy ({res.status_code}):[/bold red] {res.text}"
                )
                return

        policy = res.json()
        chain_display = " ➔ ".join(policy.get("fallback_chain", []))
        panel_content = (
            f"[bold white]{policy.get('name', 'Default Routing Policy')}[/bold white]\n"
            f"[dim]{policy.get('description', '')}[/dim]\n\n"
            f"Active Strategy: [bold cyan]{policy.get('strategy')}[/bold cyan]\n"
            f"Max Query Budget: [green]${policy.get('max_cost_per_query_usd', 0.0):.4f} USD[/green]\n"
            f"Latency Threshold: [yellow]{policy.get('max_acceptable_latency_ms', 0):.0f} ms[/yellow]\n"
            f"Privacy Constraint: [white]{policy.get('required_privacy_level') or 'None (Public Cloud Permitted)'}[/white]\n"
            f"Fallback Tier Chain:\n  [bold magenta]{chain_display}[/bold magenta]\n"
        )
        if policy.get("capability_preferences"):
            panel_content += "\nCapability Preferences:\n"
            for cap, mod in policy["capability_preferences"].items():
                panel_content += f"  • {cap}: [cyan]{mod}[/cyan]\n"

        console.print(
            Panel(
                panel_content.strip(),
                title="Intelligence Routing Policy",
                border_style="cyan",
                box=box.ROUNDED,
            )
        )
        console.print(
            "[dim]Update policy: neiman-cli config routing --strategy <strategy> --max-cost <usd> --max-latency <ms> --fallback <m1,m2>[/dim]"
        )


async def cmd_config_agent(
    identifier: str,
    autonomy: str | None = None,
    budget: float | None = None,
    tokens: int | None = None,
    status: str | None = None,
    company_id: str | None = None,
) -> None:
    """Inspect or update agent autonomy level, daily budget, and operational status."""
    api_url = get_configured_api_url()
    async with get_http_client() as client:
        comp_id = company_id or await get_active_company_id(client, api_url)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        res = await client.get(f"{api_url}/companies/{comp_id}/agents")
        if res.status_code != 200:
            console.print(
                f"[bold red]Failed fetching agents ({res.status_code}):[/bold red] {res.text}"
            )
            return

        agents = res.json()
        target = None
        ident_lower = identifier.lower().strip()
        for a in agents:
            if (
                a["id"].lower() == ident_lower
                or a["id"].lower().startswith(ident_lower)
                or a["name"].lower() == ident_lower
                or ident_lower in a["name"].lower()
            ):
                target = a
                break

        if not target:
            console.print(
                f"[bold red]Error:[/bold red] Agent '{identifier}' not found in workforce swarm."
            )
            console.print("Available Agents:")
            for a in agents:
                console.print(
                    f"  • [cyan]{a['id'][:8]}[/cyan] [white]{a['name']}[/white] ({a.get('autonomy')})"
                )
            return

        if any(x is not None for x in (autonomy, budget, tokens, status)):
            update_payload: dict[str, Any] = {}
            if autonomy:
                valid_autonomy = {"SUPERVISED", "SEMI_AUTONOMOUS", "AUTONOMOUS"}
                aut_upper = autonomy.upper()
                if aut_upper not in valid_autonomy:
                    console.print(
                        f"[bold red]Error:[/bold red] Invalid autonomy '{autonomy}'. Valid: {', '.join(sorted(valid_autonomy))}"
                    )
                    return
                update_payload["autonomy"] = aut_upper

            if status:
                valid_status = {
                    "CREATED",
                    "CONFIGURED",
                    "AVAILABLE",
                    "WORKING",
                    "BLOCKED",
                    "PAUSED",
                    "RETIRED",
                }
                stat_upper = status.upper()
                if stat_upper not in valid_status:
                    console.print(
                        f"[bold red]Error:[/bold red] Invalid status '{status}'. Valid: {', '.join(sorted(valid_status))}"
                    )
                    return
                update_payload["status"] = stat_upper

            if budget is not None or tokens is not None:
                limits = target.get("resource_limits") or {}
                if budget is not None:
                    limits["max_daily_budget_usd"] = budget
                if tokens is not None:
                    limits["max_tokens_per_call"] = tokens
                update_payload["resource_limits"] = limits

            patch_res = await client.patch(
                f"{api_url}/companies/{comp_id}/agents/{target['id']}",
                json=update_payload,
            )
            if patch_res.status_code != 200:
                console.print(
                    f"[bold red]Agent update failed ({patch_res.status_code}):[/bold red] {patch_res.text}"
                )
                return
            target = patch_res.json()
            console.print(
                f"[bold green][✓] Agent '{target['name']}' successfully updated.[/bold green]"
            )

        limits = target.get("resource_limits") or {}
        intel = target.get("intelligence_config") or {}
        panel_content = (
            f"[bold white]{target['name']}[/bold white] [dim]({target['id']})[/dim]\n"
            f"Status: [bold green]{target.get('status')}[/bold green]\n"
            f"Autonomy Level: [bold cyan]{target.get('autonomy')}[/bold cyan]\n"
            f"AI Model / Vendor: [magenta]{intel.get('provider', 'default')}/{intel.get('model', 'default')}[/magenta]\n"
            f"Max Daily Budget: [green]${limits.get('max_daily_budget_usd', 0.0):.2f} USD[/green]\n"
            f"Max Tokens Per Call: [yellow]{limits.get('max_tokens_per_call', 0):,}[/yellow]\n"
            f"Max Concurrent Tasks: {limits.get('max_concurrent_tasks', 1)}\n"
        )
        if target.get("capabilities"):
            panel_content += f"Capabilities: [dim]{', '.join(target['capabilities'])}[/dim]\n"

        console.print(
            Panel(
                panel_content.strip(),
                title=f"Agent Configuration: {target['name']}",
                border_style="cyan",
                box=box.ROUNDED,
            )
        )
        console.print(
            "[dim]Update agent: neiman-cli config agent <name|id> --autonomy <SUPERVISED|SEMI_AUTONOMOUS|AUTONOMOUS> --budget <usd> --status <status>[/dim]"
        )


async def cmd_config_constitution(
    mission: str | None = None,
    principles: str | None = None,
    prohibited: str | None = None,
    company_id: str | None = None,
) -> None:
    """Inspect or amend the company constitution, mission charter, and governance rules."""
    api_url = get_configured_api_url()
    async with get_http_client() as client:
        comp_id = company_id or await get_active_company_id(client, api_url)
        if not comp_id:
            console.print("[bold red]Error:[/bold red] No active company found.")
            return

        if any(x is not None for x in (mission, principles, prohibited)):
            payload: dict[str, Any] = {}
            if mission:
                payload["mission"] = mission
            if principles:
                payload["operating_principles"] = [
                    p.strip() for p in principles.split(",") if p.strip()
                ]
            if prohibited:
                payload["prohibited_actions"] = [
                    a.strip() for a in prohibited.split(",") if a.strip()
                ]

            res = await client.patch(
                f"{api_url}/companies/{comp_id}/governance/constitution", json=payload
            )
            if res.status_code != 200:
                console.print(
                    f"[bold red]Constitution amendment failed ({res.status_code}):[/bold red] {res.text}"
                )
                return
            console.print("[bold green][✓] Company constitution amended successfully.[/bold green]")
        else:
            res = await client.get(f"{api_url}/companies/{comp_id}/governance/constitution")
            if res.status_code != 200:
                console.print(
                    f"[bold red]Failed fetching constitution ({res.status_code}):[/bold red] {res.text}"
                )
                return

        c = res.json()
        panel_content = (
            f"[bold white]Company Constitution v{c.get('version', 1)}[/bold white] "
            f"({'[bold green]ACTIVE[/bold green]' if c.get('is_active') else '[yellow]INACTIVE[/yellow]'})\n\n"
            f"[bold cyan]Mission Statement:[/bold cyan]\n  {c.get('mission')}\n\n"
        )
        if c.get("values"):
            panel_content += "[bold cyan]Core Values:[/bold cyan]\n"
            for v in c["values"]:
                panel_content += f"  • {v}\n"
            panel_content += "\n"

        if c.get("operating_principles"):
            panel_content += "[bold cyan]Operating Principles:[/bold cyan]\n"
            for p in c["operating_principles"]:
                panel_content += f"  • {p}\n"
            panel_content += "\n"

        if c.get("prohibited_actions"):
            panel_content += "[bold red]Prohibited Actions:[/bold red]\n"
            for a in c["prohibited_actions"]:
                panel_content += f"  • [red]{a}[/red]\n"

        console.print(
            Panel(
                panel_content.strip(),
                title="Corporate Governance Constitution",
                border_style="cyan",
                box=box.ROUNDED,
            )
        )
        console.print(
            "[dim]Amend constitution: neiman-cli config constitution --mission <text> --principles <p1,p2> --prohibited <a1,a2>[/dim]"
        )


def cmd_launch_tui() -> None:
    """Launch the interactive full-screen Rust / Ratatui TUI console."""
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
    run_tui_path = os.path.join(root_dir, "run-tui.sh")
    if os.path.exists(run_tui_path):
        console.print("[bold cyan]Launching NEIMAN Native TUI Operator Console...[/bold cyan]")
        os.execv("/bin/bash", ["bash", run_tui_path])
    else:
        console.print(f"[bold red]Error:[/bold red] run-tui.sh not found at {run_tui_path}")


def ensure_backend_running(api_url: str | None = None) -> bool:
    """Check a configured API and start a local daemon without terminating other processes."""
    target = api_url or get_configured_api_url()
    parsed_target = urlsplit(target)
    host = (parsed_target.hostname or "").lower()
    is_local = host in {"127.0.0.1", "localhost", "::1"}
    api_port = parsed_target.port or 8000
    health_path = parsed_target.path.split("/api", 1)[0].rstrip("/") + "/health"
    health_url = urlunsplit(
        (parsed_target.scheme, parsed_target.netloc, health_path, "", "")
    )

    if not is_local:
        try:
            base = target.split("/api")[0]
            with httpx.Client(timeout=1.5) as c:
                res = c.get(f"{base}/health")
                return res.status_code == 200
        except Exception:
            return False

    try:
        with httpx.Client(timeout=0.8) as c:
            res = c.get(health_url)
            if res.status_code == 200:
                payload = res.json()
                if payload.get("status") == "ok" and payload.get("components", {}).get("database") == "ok":
                    return True
    except Exception:
        pass

    console.print(
        f"[bold yellow][*] NEIMAN backend is offline. Starting a local daemon on port {api_port}...[/bold yellow]"
    )
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
    data_dir = os.path.expanduser("~/.local/share/neiman")
    os.makedirs(data_dir, exist_ok=True)

    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite+aiosqlite:///{data_dir}/production.db"
    env["DISABLE_AUTH"] = os.environ.get("DISABLE_AUTH", "false")
    env["ENVIRONMENT"] = os.environ.get("ENVIRONMENT", "development")
    env["PYTHONPATH"] = os.path.join(root_dir, "apps/api")

    # Ingest API keys directly from apps/api/.env into child daemon environment
    for env_candidate in [os.path.join(root_dir, "apps/api/.env"), os.path.join(root_dir, ".env"), os.path.expanduser("~/.config/neiman/.env")]:
        if os.path.isfile(env_candidate):
            try:
                with open(env_candidate, encoding="utf-8") as ef:
                    for line in ef:
                        sline = line.strip()
                        if sline and not sline.startswith("#") and "=" in sline:
                            k, v = sline.split("=", 1)
                            val = v.strip().strip("'\"")
                            if val and k.strip() not in env:
                                env[k.strip()] = val
            except Exception:
                pass

    api_dir = os.path.join(root_dir, "apps/api")
    python_bin = os.path.join(api_dir, ".venv/bin/python")

    cmd = []
    if os.path.exists(python_bin):
        cmd = [
            python_bin,
            "-m",
            "uvicorn",
            "nexora.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(api_port),
        ]
    elif shutil.which("uv"):
        cmd = [
            "uv", "run", "uvicorn", "nexora.main:app", "--host", "127.0.0.1",
            "--port", str(api_port),
        ]
    elif sys.executable:
        cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "nexora.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(api_port),
        ]
    else:
        cmd = [
            "python3",
            "-m",
            "uvicorn",
            "nexora.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(api_port),
        ]

    log_path = os.path.join(data_dir, "daemon.log")
    with open(log_path, "a") as log_f:
        proc = subprocess.Popen(
            cmd,
            cwd=api_dir,
            env=env,
            stdout=log_f,
            stderr=log_f,
            start_new_session=True,
        )

    for _ in range(35):
        time.sleep(0.3)
        if proc.poll() is not None:
            console.print(
                f"[bold red][✗] Backend daemon process exited prematurely with code {proc.returncode}.[/bold red]"
            )
            if os.path.exists(log_path):
                with open(log_path) as f:
                    lines = f.readlines()[-10:]
                    console.print("[dim]" + "".join(lines) + "[/dim]")
            return False

        try:
            with httpx.Client(timeout=0.6) as c:
                res = c.get(health_url)
                if res.status_code == 200:
                    console.print("[bold green][✓] Backend online and ready.[/bold green]")
                    return True
        except Exception:
            pass

    console.print(
        "[bold red][✗] Timed out waiting for backend daemon readiness on port 8000.[/bold red]"
    )
    if os.path.exists(log_path):
        with open(log_path) as f:
            lines = f.readlines()[-10:]
            console.print("[dim]" + "".join(lines) + "[/dim]")
    return False


def ensure_intelligence_providers_ready() -> int:
    """Ensure all provider keys from .env are synchronized and display readiness badge."""
    count = 0
    try:
        from nexora.database import get_db_context
        from nexora.domains.intelligence.service import IntelligenceService

        async def _sync() -> int:
            async with get_db_context() as session:
                intel = IntelligenceService(session)
                c = await intel.seed_default_providers_if_empty()
                await session.commit()
                return c

        count = asyncio.run(_sync())
    except Exception:
        try:
            from nexora.config import get_settings

            st = get_settings()
            keys = [
                k
                for k in dir(st)
                if (k.endswith("_API_KEY") or k == "HF_TOKEN") and getattr(st, k, None)
            ]
            count = len(keys)
        except Exception:
            count = 0

    if count > 0:
        console.print(
            f"[bold green][✓][/bold green] [dim]NEIMAN Intelligence:[/dim] [bold]{count} AI Providers Loaded & Ready[/bold]"
        )
    return count


def cmd_help() -> None:
    """Renders the comprehensive NEIMAN OS operational command catalog."""
    table = Table(
        title="NEIMAN OS — Operational Command Architecture",
        box=box.ROUNDED,
        header_style="bold cyan",
        show_lines=True,
    )
    table.add_column("Category", style="bold yellow", width=18)
    table.add_column("Command / Subcommand", style="bold green", width=32)
    table.add_column("Description & Technical Scope", style="white")

    # Primary surfaces
    table.add_row(
        "Surfaces",
        "neiman-cli",
        "Launch interactive Rust TUI Cockpit (Default with no args)",
    )
    table.add_row(
        "Surfaces",
        "neiman-desktop",
        "Launch Native Desktop GUI application (Tauri + Next.js)",
    )
    table.add_row(
        "Surfaces",
        "neiman-cli tui",
        "Explicitly start the interactive terminal TUI Cockpit",
    )
    table.add_row(
        "Surfaces",
        "neiman-cli desktop",
        "Launch Desktop GUI application from the CLI surface",
    )

    # Lifecycle & System
    table.add_row(
        "Lifecycle",
        "neiman-cli help",
        "Display this comprehensive operational command manual",
    )
    table.add_row(
        "Lifecycle",
        "neiman-cli update",
        "Synchronize git repository, run migrations, and lock dependencies",
    )
    table.add_row(
        "Lifecycle",
        "neiman-cli setup",
        "Interactive onboarding wizard for company, workspace & provider",
    )
    table.add_row(
        "Lifecycle",
        "neiman-cli doctor",
        "Validate database schema, backend daemon, and vendor API keys",
    )

    # CTO Governance
    table.add_row(
        "CTO Governance",
        "neiman-cli status",
        "Company operational telemetry, project breakdown, and budget usage",
    )
    table.add_row(
        "CTO Governance",
        "neiman-cli directive <goal>",
        "Submit high-level strategic directive for autonomous decomposition",
    )
    table.add_row(
        "CTO Governance",
        "neiman-cli proposals",
        "List pending architectural and technical proposals awaiting gate review",
    )
    table.add_row(
        "CTO Governance",
        "neiman-cli approve <id>",
        "Approve an architectural proposal gate and schedule implementation",
    )
    table.add_row(
        "CTO Governance",
        "neiman-cli dismiss <id>",
        "Reject / dismiss a pending proposal with reason",
    )

    # Workforce & Swarm
    table.add_row(
        "Workforce Swarm",
        "neiman-cli supervisor <action>",
        "Control supervisor cycle daemon: play | pause | tick | status",
    )
    table.add_row(
        "Workforce Swarm",
        "neiman-cli swarm",
        "List workforce agents, roles, autonomy levels, and real-time states",
    )
    table.add_row(
        "Workforce Swarm",
        "neiman-cli tasks",
        "Inspect execution DAG, task dependencies, assigned agents, and outcomes",
    )
    table.add_row(
        "Workforce Swarm",
        "neiman-cli watch",
        "Real-time event stream monitoring swarm execution telemetry",
    )

    # AI Providers & Routing
    table.add_row(
        "AI Providers",
        "neiman-cli config providers",
        "List all intelligence providers, health checks, and active circuits",
    )
    table.add_row(
        "AI Providers",
        "neiman-cli config set-key",
        "Configure API key and endpoint URL for AI model provider",
    )
    table.add_row(
        "AI Providers",
        "neiman-cli config probe <name>",
        "Live latency benchmark and circuit resilience probe on vendor adapter",
    )
    table.add_row(
        "AI Providers",
        "neiman-cli config routing",
        "Inspect or update multi-provider routing policy and fallback chain",
    )
    table.add_row(
        "AI Providers",
        "neiman-cli config reset-breakers",
        "Reset tripped provider circuit breakers back to CLOSED",
    )

    console.print(table)


def cmd_update() -> None:
    """Executes the system update script scripts/update.sh."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
    update_script = os.path.join(repo_root, "scripts/update.sh")
    if not os.path.exists(update_script):
        console.print(f"[bold red]Error: Update script not found at {update_script}[/bold red]")
        sys.exit(1)
    subprocess.run([update_script], check=True)


def cmd_desktop() -> None:
    """Launches the desktop GUI application."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
    desktop_script = os.path.join(repo_root, "neiman-desktop")
    if not os.path.exists(desktop_script):
        desktop_script = os.path.join(repo_root, "run-desktop.sh")
    if not os.path.exists(desktop_script):
        console.print(f"[bold red]Error: Desktop launcher not found at {desktop_script}[/bold red]")
        sys.exit(1)
    subprocess.run([desktop_script], check=True)


async def cmd_doctor(company_id: str | None = None) -> None:
    """Performs deep health and connectivity diagnostics across NEIMAN OS subsystems."""
    console.print("[bold cyan]Running NEIMAN OS System Diagnostics...[/bold cyan]\n")
    table = Table(box=box.ROUNDED)
    table.add_column("Subsystem", style="bold yellow")
    table.add_column("Target / Check", style="white")
    table.add_column("Status", style="bold")
    table.add_column("Details", style="dim")

    # 1. API Health
    api_url = get_configured_api_url()
    try:
        async with get_http_client(timeout=5.0) as client:
            resp = await client.get(f"{api_url.rstrip('/')}/health")
            if resp.status_code == 200:
                table.add_row("Backend API", api_url, "[green]HEALTHY[/green]", "HTTP 200 OK")
            else:
                table.add_row("Backend API", api_url, "[yellow]DEGRADED[/yellow]", f"HTTP {resp.status_code}")
    except Exception as e:
        table.add_row("Backend API", api_url, "[red]OFFLINE[/red]", str(e))

    # 2. Database
    db_path = os.path.expanduser("~/.local/share/neiman/production.db")
    if os.path.exists(db_path):
        table.add_row("Database", db_path, "[green]FOUND[/green]", f"{os.path.getsize(db_path)} bytes")
    else:
        table.add_row("Database", db_path, "[yellow]INITIALIZING[/yellow]", "Database file will be created on setup")

    # 3. Binaries in ~/.local/bin/
    bin_cli = os.path.expanduser("~/.local/bin/neiman-cli")
    bin_desk = os.path.expanduser("~/.local/bin/neiman-desktop")
    table.add_row("CLI Binary", bin_cli, "[green]ACTIVE[/green]" if os.path.exists(bin_cli) else "[red]MISSING[/red]", "Canonical Terminal entrypoint")
    table.add_row("Desktop Binary", bin_desk, "[green]ACTIVE[/green]" if os.path.exists(bin_desk) else "[red]MISSING[/red]", "Canonical GUI entrypoint")

    # Legacy check
    legacy_bins = [b for b in ["neiman", "neiman-setup", "neiman-update"] if os.path.exists(os.path.expanduser(f"~/.local/bin/{b}"))]
    if legacy_bins:
        table.add_row("Legacy Binaries", ", ".join(legacy_bins), "[yellow]PRESENT[/yellow]", "Run 'neiman-cli update' to clean up")
    else:
        table.add_row("Legacy Binaries", "Clean", "[green]VERIFIED[/green]", "Strict 2-command layout enforced")

    # 4. Intelligence Providers
    try:
        async with get_http_client(timeout=5.0) as client:
            comp_id = await get_active_company_id(client, api_url)
            if comp_id:
                resp = await client.get(f"{api_url.rstrip('/')}/companies/{comp_id}/intelligence/providers")
                if resp.status_code == 200:
                    provs = resp.json()
                    cfg_count = sum(1 for p in provs if p.get("is_configured"))
                    hlth_count = sum(1 for p in provs if p.get("is_healthy"))
                    table.add_row("AI Providers", f"{len(provs)} providers registered", "[green]OPERATIONAL[/green]", f"{cfg_count} configured, {hlth_count} healthy")
    except Exception:
        pass

    console.print(table)


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help", "help"):
        cmd_help()
        return
    parser = argparse.ArgumentParser(
        prog="neiman-cli",
        description="NEIMAN OS — Autonomous CTO & Workforce Swarm Operator CLI",
    )
    subparsers = parser.add_subparsers(dest="subcommand", help="Available subcommands")

    # setup
    p_setup = subparsers.add_parser(
        "setup",
        aliases=["init", "onboard"],
        help="Interactive Setup Wizard: configure blueprint, provider, workspace, and CTO roadmap",
    )
    p_setup.add_argument(
        "--blueprint",
        default="software_development_company",
        help="Blueprint slug: software_development_company, cybersecurity_company, marketing_agency",
    )
    p_setup.add_argument("--name", help="Company / enterprise name override")
    p_setup.add_argument("--provider", help="AI provider (e.g. openai, anthropic, gemini, groq, openrouter, local_ollama)")
    p_setup.add_argument("--key", help="API key secret for AI provider")
    p_setup.add_argument("--url", help="Custom base URL endpoint override (e.g. for Ollama / vLLM)")
    p_setup.add_argument("--project", help="Custom project initiative name")
    p_setup.add_argument("--workspace", help="Workspace path to scan and link (e.g. . or /path/to/repo)")
    p_setup.add_argument("--goal", help="Initial high-level directive or engineering roadmap goal")
    p_setup.add_argument(
        "--priority",
        default="HIGH",
        choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        help="Initial roadmap priority",
    )
    p_setup.add_argument(
        "--non-interactive",
        action="store_true",
        help="Run setup in non-interactive / automated batch mode",
    )
    p_setup.add_argument(
        "--no-plan", action="store_true", help="Skip automatic CTO roadmap planning"
    )
    p_setup.add_argument("--company", help="Company ID override")

    # status
    p_status = subparsers.add_parser("status", help="Display organizational status and CTO metrics")
    p_status.add_argument("--company", help="Company ID override")

    # directive
    p_dir = subparsers.add_parser("directive", help="Issue high-level engineering directive to CTO")
    p_dir.add_argument("goal", help="Engineering directive / task description")
    p_dir.add_argument("--priority", default="HIGH", help="Priority: LOW, MEDIUM, HIGH, CRITICAL")
    p_dir.add_argument("--company", help="Company ID override")

    # proposals
    p_prop = subparsers.add_parser("proposals", help="List proactive initiatives from CTO")
    p_prop.add_argument("--company", help="Company ID override")

    # approve
    p_app = subparsers.add_parser("approve", help="Approve and delegate CTO proposal")
    p_app.add_argument("proposal_id", help="UUID of proposal to approve")
    p_app.add_argument("--company", help="Company ID override")

    # dismiss
    p_dis = subparsers.add_parser("dismiss", help="Dismiss CTO proposal")
    p_dis.add_argument("proposal_id", help="UUID of proposal to dismiss")
    p_dis.add_argument("--company", help="Company ID override")

    # supervisor
    p_sup = subparsers.add_parser(
        "supervisor", help="Control continuous development supervisor daemon"
    )
    p_sup.add_argument(
        "action", choices=["play", "pause", "tick", "status"], help="Supervisor action"
    )
    p_sup.add_argument("--company", help="Company ID override")

    # swarm
    p_swarm = subparsers.add_parser("swarm", help="List workforce swarm agents")
    p_swarm.add_argument("--company", help="Company ID override")

    # tasks
    p_tasks = subparsers.add_parser("tasks", help="List project tasks and dependency status")
    p_tasks.add_argument("--company", help="Company ID override")

    # project
    p_proj = subparsers.add_parser(
        "project", aliases=["projects"], help="Manage organizational projects and assignments"
    )
    proj_sub = p_proj.add_subparsers(dest="project_action", help="Project operations")

    # project list
    p_proj_list = proj_sub.add_parser("list", help="List all company projects and progress")
    p_proj_list.add_argument("--company", help="Company ID override")

    # project create
    p_proj_create = proj_sub.add_parser(
        "create", aliases=["new"], help="Create a new engineering project"
    )
    p_proj_create.add_argument("name", help="Project name")
    p_proj_create.add_argument("--objective", "-o", help="Project objective / description")
    p_proj_create.add_argument(
        "--priority",
        "-p",
        choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        default="MEDIUM",
        help="Project priority",
    )
    p_proj_create.add_argument("--company", help="Company ID override")

    # project assign
    p_proj_assign = proj_sub.add_parser(
        "assign", help="Assign an entire project (all tasks) to an agent"
    )
    p_proj_assign.add_argument("project", help="Project UUID or name substring")
    p_proj_assign.add_argument("agent", help="Agent UUID or name substring")
    p_proj_assign.add_argument("--company", help="Company ID override")

    # project tasks
    p_proj_tasks = proj_sub.add_parser("tasks", help="List tasks belonging to a specific project")
    p_proj_tasks.add_argument("project", help="Project UUID or name substring")
    p_proj_tasks.add_argument("--company", help="Company ID override")

    # task
    p_task = subparsers.add_parser("task", help="Inspect and assign individual tasks")
    task_sub = p_task.add_subparsers(dest="task_action", help="Task operations")

    # task assign
    p_task_assign = task_sub.add_parser(
        "assign", help="Assign a specific task to an agent employee"
    )
    p_task_assign.add_argument("task", help="Task UUID prefix or title substring")
    p_task_assign.add_argument("agent", help="Agent UUID or name substring")
    p_task_assign.add_argument("--company", help="Company ID override")

    # task create / new / add
    p_task_create = task_sub.add_parser(
        "create", aliases=["new", "add"], help="Create a new task in active project"
    )
    p_task_create.add_argument("title", help="Task title")
    p_task_create.add_argument("--project", help="Project identifier (UUID or name)")
    p_task_create.add_argument(
        "--priority",
        choices=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        default="MEDIUM",
        help="Task priority",
    )
    p_task_create.add_argument("--company", help="Company ID override")

    # agent / hermes interactive operator console
    p_agent = subparsers.add_parser(
        "agent",
        aliases=["hermes", "interactive"],
        help="Launch Hermes Agent-style interactive operator console",
    )
    p_agent.add_argument("--company", help="Company ID override")

    # watch
    p_watch = subparsers.add_parser(
        "watch", help="Stream live continuous telemetry waterfall in terminal"
    )
    p_watch.add_argument("--company", help="Company ID override")

    # config
    p_config = subparsers.add_parser(
        "config", help="Manage persistent CLI settings, AI providers, routing policies, and agents"
    )
    config_sub = p_config.add_subparsers(dest="config_action", help="Config operations")

    # config show
    p_cfg_show = config_sub.add_parser(
        "show", help="Display CLI configuration, connection health, and active company"
    )
    p_cfg_show.add_argument("--company", help="Company ID override")

    # config set
    p_cfg_set = config_sub.add_parser(
        "set", help="Set persistent configuration key (api_url, company_id, token, timeout)"
    )
    p_cfg_set.add_argument("key", help="Configuration key (api_url, company_id, token, timeout)")
    p_cfg_set.add_argument("value", help="Value to set")

    # config get
    p_cfg_get = config_sub.add_parser("get", help="Get persistent configuration key or all keys")
    p_cfg_get.add_argument("key", nargs="?", default="all", help="Key to retrieve or 'all'")

    # config providers
    p_cfg_prov = config_sub.add_parser(
        "providers", help="List registered AI model providers and vault key status"
    )
    p_cfg_prov.add_argument("--company", help="Company ID override")

    # config set-key
    p_cfg_key = config_sub.add_parser(
        "set-key", help="Store encrypted provider API key in backend vault"
    )
    p_cfg_key.add_argument(
        "provider", help="Provider identifier (e.g. openai, anthropic, gemini, deepseek, ollama)"
    )
    p_cfg_key.add_argument("key", help="API key secret to encrypt in vault")
    p_cfg_key.add_argument("--url", help="Custom base URL endpoint override")
    p_cfg_key.add_argument(
        "--no-discover", action="store_true", help="Skip automatic model catalog discovery"
    )
    p_cfg_key.add_argument("--company", help="Company ID override")

    # config probe
    p_cfg_probe = config_sub.add_parser(
        "probe", help="Live probe vendor endpoint latency, health, and circuit breaker"
    )
    p_cfg_probe.add_argument("provider", help="Provider identifier to probe")
    p_cfg_probe.add_argument(
        "--simulate", choices=["rate_limit", "timeout", "500"], help="Simulate a fault"
    )
    p_cfg_probe.add_argument("--timeout", type=float, default=10.0, help="Probe timeout in seconds")
    p_cfg_probe.add_argument("--company", help="Company ID override")

    # config reset-breakers
    p_cfg_reset = config_sub.add_parser(
        "reset-breakers", help="Reset all AI provider circuit breakers to CLOSED"
    )
    p_cfg_reset.add_argument("--company", help="Company ID override")

    # config sync-models
    p_cfg_sync = config_sub.add_parser(
        "sync-models", help="Dynamically sync available models from all configured provider API keys"
    )
    p_cfg_sync.add_argument("--company", help="Company ID override")

    # config routing
    p_cfg_rout = config_sub.add_parser(
        "routing", help="Inspect or update model routing policy and fallback chain"
    )
    p_cfg_rout.add_argument(
        "--strategy",
        choices=["CHEAPEST", "FASTEST", "BALANCED", "HIGHEST_QUALITY"],
        help="Routing strategy",
    )
    p_cfg_rout.add_argument("--max-cost", type=float, help="Max USD cost per query")
    p_cfg_rout.add_argument("--max-latency", type=float, help="Max acceptable latency in ms")
    p_cfg_rout.add_argument(
        "--fallback",
        help="Comma-separated fallback model names (e.g. 'claude-3-5-sonnet,gemini-1.5-pro')",
    )
    p_cfg_rout.add_argument("--company", help="Company ID override")

    # config agent
    p_cfg_agent = config_sub.add_parser(
        "agent", help="Inspect or configure agent autonomy, daily budget, and status"
    )
    p_cfg_agent.add_argument("identifier", help="Agent UUID or name substring")
    p_cfg_agent.add_argument(
        "--autonomy", choices=["SUPERVISED", "SEMI_AUTONOMOUS", "AUTONOMOUS"], help="Autonomy level"
    )
    p_cfg_agent.add_argument("--budget", type=float, help="Max daily budget in USD")
    p_cfg_agent.add_argument("--tokens", type=int, help="Max tokens per call limit")
    p_cfg_agent.add_argument(
        "--status", choices=["AVAILABLE", "WORKING", "PAUSED", "RETIRED"], help="Agent status"
    )
    p_cfg_agent.add_argument("--company", help="Company ID override")

    # config constitution
    p_cfg_const = config_sub.add_parser(
        "constitution", help="Inspect or amend company constitution and operating principles"
    )
    p_cfg_const.add_argument("--mission", help="Updated corporate mission statement")
    p_cfg_const.add_argument("--principles", help="Comma-separated operating principles")
    p_cfg_const.add_argument("--prohibited", help="Comma-separated prohibited actions")
    p_cfg_const.add_argument("--company", help="Company ID override")

    # Lifecycle & Utility Subcommands
    subparsers.add_parser("help", help="Comprehensive NEIMAN OS operational command catalog")
    subparsers.add_parser("update", help="Synchronize git repository, update database, and lock dependencies")
    subparsers.add_parser("desktop", help="Launch native desktop GUI application")
    p_doc = subparsers.add_parser("doctor", help="Run system diagnostics across API, DB, and AI providers")
    p_doc.add_argument("--company", help="Company ID override")

    # tui
    subparsers.add_parser("tui", help="Launch interactive full-screen TUI operator console")

    args = parser.parse_args()

    if args.subcommand == "help":
        cmd_help()
        return

    if args.subcommand == "desktop":
        cmd_desktop()
        return

    if args.subcommand == "update":
        cmd_update()
        return

    if args.subcommand == "doctor":
        asyncio.run(cmd_doctor(getattr(args, "company", None)))
        return

    # Skip daemon auto-boot for local persistent configuration set/get
    if args.subcommand == "config" and getattr(args, "config_action", None) in ("set", "get"):
        pass
    else:
        ensure_backend_running()
        ensure_intelligence_providers_ready()

    if not args.subcommand or args.subcommand == "tui":
        cmd_launch_tui()
        return

    if args.subcommand in ("setup", "init", "onboard"):
        asyncio.run(
            cmd_setup(
                company_id=getattr(args, "company", None),
                blueprint=getattr(args, "blueprint", "software_development_company"),
                company_name=getattr(args, "name", None),
                provider=getattr(args, "provider", None),
                key=getattr(args, "key", None),
                url=getattr(args, "url", None),
                project_name=getattr(args, "project", None),
                workspace_path=getattr(args, "workspace", None),
                goal=getattr(args, "goal", None),
                priority=getattr(args, "priority", "HIGH"),
                non_interactive=getattr(args, "non_interactive", False),
                auto_plan=not getattr(args, "no_plan", False),
            )
        )
    elif args.subcommand == "status":
        asyncio.run(cmd_status(getattr(args, "company", None)))
    elif args.subcommand == "directive":
        asyncio.run(
            cmd_directive(
                args.goal, getattr(args, "priority", "HIGH"), getattr(args, "company", None)
            )
        )
    elif args.subcommand == "proposals":
        asyncio.run(cmd_proposals(getattr(args, "company", None)))
    elif args.subcommand == "approve":
        asyncio.run(cmd_approve_proposal(args.proposal_id, getattr(args, "company", None)))
    elif args.subcommand == "dismiss":
        asyncio.run(cmd_dismiss_proposal(args.proposal_id, getattr(args, "company", None)))
    elif args.subcommand == "supervisor":
        asyncio.run(cmd_supervisor(args.action, getattr(args, "company", None)))
    elif args.subcommand == "swarm":
        asyncio.run(cmd_swarm(getattr(args, "company", None)))
    elif args.subcommand == "tasks":
        asyncio.run(cmd_tasks(getattr(args, "company", None)))
    elif args.subcommand in ("agent", "hermes", "interactive"):
        asyncio.run(cmd_hermes_agent(getattr(args, "company", None)))
    elif args.subcommand in ("project", "projects"):
        action = getattr(args, "project_action", None) or "list"
        if action == "list":
            asyncio.run(cmd_project_list(getattr(args, "company", None)))
        elif action in ("create", "new"):
            asyncio.run(
                cmd_project_create(
                    args.name,
                    getattr(args, "objective", None),
                    getattr(args, "priority", "MEDIUM"),
                    getattr(args, "company", None),
                )
            )
        elif action == "assign":
            asyncio.run(
                cmd_project_assign(args.project, args.agent, getattr(args, "company", None))
            )
        elif action == "tasks":
            asyncio.run(cmd_project_tasks(args.project, getattr(args, "company", None)))
    elif args.subcommand == "task":
        action = getattr(args, "task_action", None) or "assign"
        if action == "assign":
            asyncio.run(cmd_task_assign(args.task, args.agent, getattr(args, "company", None)))
        elif action in ("create", "new", "add"):
            asyncio.run(
                cmd_task_create(
                    args.title,
                    getattr(args, "project", None),
                    getattr(args, "priority", "MEDIUM"),
                    getattr(args, "company", None),
                )
            )
    elif args.subcommand == "watch":
        asyncio.run(cmd_watch(getattr(args, "company", None)))
    elif args.subcommand == "config":
        action = getattr(args, "config_action", None) or "show"
        if action == "show":
            asyncio.run(cmd_config_show(getattr(args, "company", None)))
        elif action == "set":
            cmd_config_set(args.key, args.value)
        elif action == "get":
            cmd_config_get(getattr(args, "key", "all"))
        elif action == "providers":
            asyncio.run(cmd_config_providers(getattr(args, "company", None)))
        elif action == "set-key":
            asyncio.run(
                cmd_config_set_key(
                    args.provider,
                    args.key,
                    getattr(args, "url", None),
                    not getattr(args, "no_discover", False),
                    getattr(args, "company", None),
                )
            )
        elif action == "probe":
            asyncio.run(
                cmd_config_probe(
                    args.provider,
                    getattr(args, "simulate", None),
                    getattr(args, "timeout", 10.0),
                    getattr(args, "company", None),
                )
            )
        elif action == "reset-breakers":
            asyncio.run(cmd_config_reset_breakers(getattr(args, "company", None)))
        elif action == "sync-models":
            asyncio.run(cmd_config_sync_models(getattr(args, "company", None)))
        elif action == "routing":
            asyncio.run(
                cmd_config_routing(
                    getattr(args, "strategy", None),
                    getattr(args, "max_cost", None),
                    getattr(args, "max_latency", None),
                    getattr(args, "fallback", None),
                    getattr(args, "company", None),
                )
            )
        elif action == "agent":
            asyncio.run(
                cmd_config_agent(
                    args.identifier,
                    getattr(args, "autonomy", None),
                    getattr(args, "budget", None),
                    getattr(args, "tokens", None),
                    getattr(args, "status", None),
                    getattr(args, "company", None),
                )
            )
        elif action == "constitution":
            asyncio.run(
                cmd_config_constitution(
                    getattr(args, "mission", None),
                    getattr(args, "principles", None),
                    getattr(args, "prohibited", None),
                    getattr(args, "company", None),
                )
            )


if __name__ == "__main__":
    main()
