use std::collections::{HashMap, HashSet, VecDeque};
use serde::{Deserialize, Serialize};
use crate::client::ProjectPayload;
use crate::common::TaskViewItem;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GraphNodeStatus {
    Ready,
    InProgress,
    Waiting,
    Blocked,
    Failed,
    Done,
    Cancelled,
}

impl GraphNodeStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            GraphNodeStatus::Ready => "READY",
            GraphNodeStatus::InProgress => "IN PROGRESS",
            GraphNodeStatus::Waiting => "WAITING",
            GraphNodeStatus::Blocked => "BLOCKED",
            GraphNodeStatus::Failed => "FAILED",
            GraphNodeStatus::Done => "DONE",
            GraphNodeStatus::Cancelled => "CANCELLED",
        }
    }

    pub fn badge(&self) -> &'static str {
        match self {
            GraphNodeStatus::Ready => "[READY]",
            GraphNodeStatus::InProgress => "[RUNNING]",
            GraphNodeStatus::Waiting => "[WAITING]",
            GraphNodeStatus::Blocked => "[BLOCKED]",
            GraphNodeStatus::Failed => "[FAILED]",
            GraphNodeStatus::Done => "[DONE]",
            GraphNodeStatus::Cancelled => "[CANCELLED]",
        }
    }

    pub fn symbol(&self) -> &'static str {
        match self {
            GraphNodeStatus::Ready => "⚡",
            GraphNodeStatus::InProgress => "▶",
            GraphNodeStatus::Waiting => "⏳",
            GraphNodeStatus::Blocked => "⛔",
            GraphNodeStatus::Failed => "✗",
            GraphNodeStatus::Done => "✓",
            GraphNodeStatus::Cancelled => "⊘",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GraphNodeType {
    ProjectRoot,
    Milestone,
    Task,
    Subtask,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissionGraphNode {
    pub id: String,
    pub title: String,
    pub node_type: GraphNodeType,
    pub status: GraphNodeStatus,
    pub priority: String,
    pub project_id: Option<String>,
    pub project_name: String,
    pub assigned_agent: String,
    pub dependencies: Vec<String>,
    pub dependants: Vec<String>,
    pub blockers: Vec<String>,
    pub downstream_impact: usize,
    pub acceptance_criteria: Vec<String>,
    pub depth: usize,
    pub connector: String,
    pub is_expanded: bool,
}

#[derive(Debug, Clone, Default)]
pub struct MissionGraphState {
    pub nodes: Vec<MissionGraphNode>,
    pub selected_idx: usize,
    pub filter_project: Option<String>,
    pub filter_agent: Option<String>,
    pub filter_status: Option<GraphNodeStatus>,
    pub filter_priority: Option<String>,
    pub search_query: String,
    pub is_filtering: bool,
    pub scroll_offset: usize,
}

impl MissionGraphState {
    pub fn filtered_indices(&self) -> Vec<usize> {
        self.nodes
            .iter()
            .enumerate()
            .filter(|(_, node)| {
                if let Some(p) = &self.filter_project {
                    if node.project_name != *p && node.id != *p {
                        return false;
                    }
                }
                if let Some(a) = &self.filter_agent {
                    if &node.assigned_agent != a {
                        return false;
                    }
                }
                if let Some(s) = self.filter_status {
                    if node.status != s {
                        return false;
                    }
                }
                if let Some(prio) = &self.filter_priority {
                    if &node.priority != prio {
                        return false;
                    }
                }
                if !self.search_query.is_empty() {
                    let q = self.search_query.to_lowercase();
                    if !node.title.to_lowercase().contains(&q)
                        && !node.id.to_lowercase().contains(&q)
                        && !node.assigned_agent.to_lowercase().contains(&q)
                    {
                        return false;
                    }
                }
                true
            })
            .map(|(i, _)| i)
            .collect()
    }

    pub fn selected_node(&self) -> Option<&MissionGraphNode> {
        let indices = self.filtered_indices();
        if indices.is_empty() {
            None
        } else {
            let actual_idx = indices[self.selected_idx.min(indices.len() - 1)];
            self.nodes.get(actual_idx)
        }
    }

    pub fn critical_blockers_count(&self) -> usize {
        self.nodes
            .iter()
            .filter(|n| (n.status == GraphNodeStatus::Failed || n.status == GraphNodeStatus::Blocked) && n.downstream_impact > 0)
            .count()
    }

    pub fn parallel_ready_count(&self) -> usize {
        self.nodes
            .iter()
            .filter(|n| n.status == GraphNodeStatus::Ready)
            .count()
    }
}

/// Builds the comprehensive Mission & Dependency Graph from live project and task state.
pub fn build_mission_graph(
    projects: &[ProjectPayload],
    tasks: &[TaskViewItem],
    _agent_names: &HashMap<String, String>,
) -> MissionGraphState {
    let mut nodes = Vec::new();
    let mut task_map: HashMap<String, &TaskViewItem> = HashMap::new();
    let mut proj_map: HashMap<String, String> = HashMap::new();

    for p in projects {
        proj_map.insert(p.id.clone(), p.name.clone());
    }
    for t in tasks {
        task_map.insert(t.id.clone(), t);
    }

    // 1. Build reverse dependency lookup (dependants)
    let mut dependants_map: HashMap<String, Vec<String>> = HashMap::new();
    for t in tasks {
        for dep in &t.dependencies {
            dependants_map.entry(dep.clone()).or_default().push(t.id.clone());
        }
    }

    // 2. Compute downstream impact recursively for each task
    let mut impact_map: HashMap<String, usize> = HashMap::new();
    for t in tasks {
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        queue.push_back(t.id.clone());

        while let Some(curr) = queue.pop_front() {
            if let Some(children) = dependants_map.get(&curr) {
                for child in children {
                    if visited.insert(child.clone()) {
                        queue.push_back(child.clone());
                    }
                }
            }
        }
        impact_map.insert(t.id.clone(), visited.len());
    }

    // 3. Resolve status vocabulary strictly:
    // - DONE if COMPLETED/DONE
    // - IN PROGRESS if IN_PROGRESS/RUNNING
    // - FAILED if FAILED
    // - CANCELLED if CANCELLED
    // - If PENDING/WAITING:
    //   - Check upstream dependencies:
    //     - If ANY dep is FAILED or BLOCKED => BLOCKED (identify blockers)
    //     - If ALL deps are DONE => READY
    //     - If deps are PENDING/RUNNING => WAITING
    let mut resolved_statuses: HashMap<String, (GraphNodeStatus, Vec<String>)> = HashMap::new();

    // First pass for explicit terminal/running states
    for t in tasks {
        let raw = t.status.to_uppercase();
        if raw == "COMPLETED" || raw == "DONE" || raw == "SUCCESS" {
            resolved_statuses.insert(t.id.clone(), (GraphNodeStatus::Done, Vec::new()));
        } else if raw == "IN_PROGRESS" || raw == "RUNNING" || raw == "WORKING" {
            resolved_statuses.insert(t.id.clone(), (GraphNodeStatus::InProgress, Vec::new()));
        } else if raw == "FAILED" {
            resolved_statuses.insert(t.id.clone(), (GraphNodeStatus::Failed, Vec::new()));
        } else if raw == "CANCELLED" {
            resolved_statuses.insert(t.id.clone(), (GraphNodeStatus::Cancelled, Vec::new()));
        }
    }

    // Second pass for pending/waiting tasks evaluating blockers vs readiness
    let mut changed = true;
    let mut iterations = 0;
    while changed && iterations < 10 {
        changed = false;
        iterations += 1;
        for t in tasks {
            if resolved_statuses.contains_key(&t.id) {
                continue;
            }

            let mut has_failed_blocker = false;
            let mut all_deps_done = true;
            let mut blocker_descriptions = Vec::new();

            for dep_id in &t.dependencies {
                if let Some((st, _)) = resolved_statuses.get(dep_id) {
                    match st {
                        GraphNodeStatus::Failed => {
                            has_failed_blocker = true;
                            all_deps_done = false;
                            let title = task_map.get(dep_id).map(|x| x.title.as_str()).unwrap_or("Task");
                            blocker_descriptions.push(format!("{} [{}]", title, dep_id));
                        }
                        GraphNodeStatus::Blocked => {
                            has_failed_blocker = true;
                            all_deps_done = false;
                            let title = task_map.get(dep_id).map(|x| x.title.as_str()).unwrap_or("Task");
                            blocker_descriptions.push(format!("{} (Cascade) [{}]", title, dep_id));
                        }
                        GraphNodeStatus::Done => {}
                        _ => {
                            all_deps_done = false;
                        }
                    }
                } else if let Some(parent_task) = task_map.get(dep_id) {
                    if parent_task.status == "FAILED" || parent_task.status == "BLOCKED" {
                        has_failed_blocker = true;
                        all_deps_done = false;
                        blocker_descriptions.push(format!("{} [{}]", parent_task.title, dep_id));
                    } else if parent_task.status != "COMPLETED" && parent_task.status != "DONE" {
                        all_deps_done = false;
                    }
                } else {
                    // Missing dependency in local set is treated as unresolved blocker
                    all_deps_done = false;
                    blocker_descriptions.push(format!("External dependency [{}]", dep_id));
                }
            }

            if has_failed_blocker {
                resolved_statuses.insert(t.id.clone(), (GraphNodeStatus::Blocked, blocker_descriptions));
                changed = true;
            } else if t.dependencies.is_empty() || all_deps_done {
                resolved_statuses.insert(t.id.clone(), (GraphNodeStatus::Ready, Vec::new()));
                changed = true;
            } else {
                resolved_statuses.insert(t.id.clone(), (GraphNodeStatus::Waiting, Vec::new()));
                changed = true;
            }
        }
    }

    // Default remaining to Waiting
    for t in tasks {
        resolved_statuses.entry(t.id.clone()).or_insert((GraphNodeStatus::Waiting, Vec::new()));
    }

    // 4. Construct Structured Nodes Grouped by Project Roots
    let mut project_tasks: HashMap<String, Vec<&TaskViewItem>> = HashMap::new();
    for t in tasks {
        let p_id = t.project_id.clone().unwrap_or_else(|| "general".into());
        project_tasks.entry(p_id).or_default().push(t);
    }

    // Create Mission/Company Directive Root if projects exist
    if !projects.is_empty() {
        for proj in projects {
            let p_name = proj.name.clone();
            let p_tasks = project_tasks.get(&proj.id).cloned().unwrap_or_default();
            let proj_status = if p_tasks.is_empty() {
                GraphNodeStatus::Waiting
            } else if p_tasks.iter().all(|t| resolved_statuses.get(&t.id).map(|s| s.0 == GraphNodeStatus::Done).unwrap_or(false)) {
                GraphNodeStatus::Done
            } else if p_tasks.iter().any(|t| resolved_statuses.get(&t.id).map(|s| s.0 == GraphNodeStatus::Failed || s.0 == GraphNodeStatus::Blocked).unwrap_or(false)) {
                GraphNodeStatus::Blocked
            } else if p_tasks.iter().any(|t| resolved_statuses.get(&t.id).map(|s| s.0 == GraphNodeStatus::InProgress).unwrap_or(false)) {
                GraphNodeStatus::InProgress
            } else {
                GraphNodeStatus::Ready
            };

            // Project Root Node
            nodes.push(MissionGraphNode {
                id: proj.id.clone(),
                title: format!("PROJECT: {}", proj.name),
                node_type: GraphNodeType::ProjectRoot,
                status: proj_status,
                priority: proj.priority.clone().unwrap_or_else(|| "HIGH".into()),
                project_id: Some(proj.id.clone()),
                project_name: p_name.clone(),
                assigned_agent: "Software Architect".into(),
                dependencies: vec![],
                dependants: vec![],
                blockers: vec![],
                downstream_impact: p_tasks.len(),
                acceptance_criteria: vec![
                    format!("Objective: {}", proj.objective.as_deref().unwrap_or("Execute roadmap milestones")),
                    "All dependent implementation tasks verified clean".into(),
                ],
                depth: 0,
                connector: "■".into(),
                is_expanded: true,
            });

            // Add Child Tasks under this Project
            let total_tasks = p_tasks.len();
            for (idx, task) in p_tasks.into_iter().enumerate() {
                let is_last = idx == total_tasks - 1;
                let connector = if is_last { "└─ " } else { "├─ " };
                let (st, blockers) = resolved_statuses.get(&task.id).cloned().unwrap_or((GraphNodeStatus::Waiting, Vec::new()));
                let impact = impact_map.get(&task.id).cloned().unwrap_or(0);
                let deps = task.dependencies.clone();
                let succs = dependants_map.get(&task.id).cloned().unwrap_or_default();

                nodes.push(MissionGraphNode {
                    id: task.id.clone(),
                    title: task.title.clone(),
                    node_type: if deps.is_empty() { GraphNodeType::Task } else { GraphNodeType::Subtask },
                    status: st,
                    priority: task.priority.clone(),
                    project_id: Some(proj.id.clone()),
                    project_name: p_name.clone(),
                    assigned_agent: task.assigned_agent.clone(),
                    dependencies: deps,
                    dependants: succs,
                    blockers,
                    downstream_impact: impact,
                    acceptance_criteria: vec![
                        format!("Task Unit [{}] verification", &task.id[..task.id.len().min(8)]),
                        "Pass automated verification gate without security regressions".into(),
                    ],
                    depth: 1,
                    connector: connector.into(),
                    is_expanded: true,
                });
            }
        }
    } else {
        // Fallback when no projects exist: render tasks directly
        let total = tasks.len();
        for (idx, task) in tasks.iter().enumerate() {
            let is_last = idx == total.saturating_sub(1);
            let connector = if is_last { "└─ " } else { "├─ " };
            let (st, blockers) = resolved_statuses.get(&task.id).cloned().unwrap_or((GraphNodeStatus::Waiting, Vec::new()));
            let impact = impact_map.get(&task.id).cloned().unwrap_or(0);
            let deps = task.dependencies.clone();
            let succs = dependants_map.get(&task.id).cloned().unwrap_or_default();

            nodes.push(MissionGraphNode {
                id: task.id.clone(),
                title: task.title.clone(),
                node_type: GraphNodeType::Task,
                status: st,
                priority: task.priority.clone(),
                project_id: task.project_id.clone(),
                project_name: "General Operations".into(),
                assigned_agent: task.assigned_agent.clone(),
                dependencies: deps,
                dependants: succs,
                blockers,
                downstream_impact: impact,
                acceptance_criteria: vec!["Acceptance criteria verification".into()],
                depth: 0,
                connector: connector.into(),
                is_expanded: true,
            });
        }
    }

    MissionGraphState {
        nodes,
        selected_idx: 0,
        filter_project: None,
        filter_agent: None,
        filter_status: None,
        filter_priority: None,
        search_query: String::new(),
        is_filtering: false,
        scroll_offset: 0,
    }
}

/// Validates that adding a dependency from `from_task_id` to `to_task_id` does NOT introduce a cycle.
pub fn validate_dependency_addition(
    tasks: &[TaskViewItem],
    from_task_id: &str,
    to_task_id: &str,
) -> Result<(), String> {
    if from_task_id == to_task_id {
        return Err(format!("Self-dependency rejected: task '{}' cannot depend on itself.", from_task_id));
    }

    // Build adjacency list including candidate edge
    let mut adj: HashMap<&str, Vec<&str>> = HashMap::new();
    for t in tasks {
        for dep in &t.dependencies {
            adj.entry(t.id.as_str()).or_default().push(dep.as_str());
        }
    }
    adj.entry(from_task_id).or_default().push(to_task_id);

    // Run cycle detection DFS
    let mut visited: HashSet<&str> = HashSet::new();
    let mut rec_stack: HashSet<&str> = HashSet::new();

    for node in adj.keys() {
        if !visited.contains(node)
            && has_cycle_dfs(node, &adj, &mut visited, &mut rec_stack) {
                return Err(format!(
                    "Circular dependency rejected: Adding dependency '{}' -> '{}' forms an invalid cycle.",
                    from_task_id, to_task_id
                ));
            }
    }

    Ok(())
}

fn has_cycle_dfs<'a>(
    node: &'a str,
    adj: &HashMap<&'a str, Vec<&'a str>>,
    visited: &mut HashSet<&'a str>,
    rec_stack: &mut HashSet<&'a str>,
) -> bool {
    visited.insert(node);
    rec_stack.insert(node);

    if let Some(neighbors) = adj.get(node) {
        for &neighbor in neighbors {
            if !visited.contains(neighbor) {
                if has_cycle_dfs(neighbor, adj, visited, rec_stack) {
                    return true;
                }
            } else if rec_stack.contains(neighbor) {
                return true;
            }
        }
    }

    rec_stack.remove(node);
    false
}
