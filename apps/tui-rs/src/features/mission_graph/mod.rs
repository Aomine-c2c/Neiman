pub mod model;
pub mod ui;

pub use model::*;
pub use ui::*;

use crate::AppState;

pub fn inspector_text(state: &AppState) -> Option<String> {
    let graph = &state.mission_graph_state;
    if let Some(node) = graph.selected_node() {
        let blockers_str = if node.blockers.is_empty() {
            "None".to_string()
        } else {
            node.blockers.join(", ")
        };
        let preds_str = if node.dependencies.is_empty() {
            "None".to_string()
        } else {
            node.dependencies.join(", ")
        };
        let succs_str = if node.dependants.is_empty() {
            "None".to_string()
        } else {
            node.dependants.join(", ")
        };

        Some(format!(
            "MISSION GRAPH NODE INSPECTOR\n\nID          : {}\nTITLE       : {}\nPROJECT     : {}\nSTATUS      : {}\nPRIORITY    : {}\nASSIGNED    : @{}\nBLOCKERS    : {}\nHOLDS UP    : {} downstream task(s)\nPREDS       : {}\nSUCCS       : {}\n\nPress [a] for Assigned Agent | [e] for Changes | [Enter] for Full Details",
            node.id,
            node.title,
            node.project_name,
            node.status.as_str(),
            node.priority,
            node.assigned_agent,
            blockers_str,
            node.downstream_impact,
            preds_str,
            succs_str
        ))
    } else {
        Some("MISSION GRAPH TELEMETRY\n\nNo node currently selected.\nUse [↑/↓] or [k/j] to navigate project directives and task dependencies.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::backend::TestBackend;
    use ratatui::Terminal;
    use crate::client::ProjectPayload;
    use crate::common::TaskViewItem;

    fn create_test_projects_and_tasks() -> (Vec<ProjectPayload>, Vec<TaskViewItem>) {
        let projects = vec![ProjectPayload {
            id: "proj-core".into(),
            name: "Enterprise Core".into(),
            objective: Some("Core engine capabilities".into()),
            status: Some("ACTIVE".into()),
            priority: Some("CRITICAL".into()),
        }];

        let tasks = vec![
            TaskViewItem {
                id: "t1".into(),
                title: "Initialize Database Schema".into(),
                status: "COMPLETED".into(),
                priority: "HIGH".into(),
                project_id: Some("proj-core".into()),
                assigned_agent: "DevOps Lead".into(),
                dependencies: vec![],
                ..Default::default()
            },
            TaskViewItem {
                id: "t2".into(),
                title: "Build Authentication Service".into(),
                status: "IN_PROGRESS".into(),
                priority: "CRITICAL".into(),
                project_id: Some("proj-core".into()),
                assigned_agent: "Software Architect".into(),
                dependencies: vec!["t1".into()],
                ..Default::default()
            },
            TaskViewItem {
                id: "t3".into(),
                title: "Deploy API Gateway".into(),
                status: "PENDING".into(),
                priority: "MEDIUM".into(),
                project_id: Some("proj-core".into()),
                assigned_agent: "DevOps Lead".into(),
                dependencies: vec!["t2".into()],
                ..Default::default()
            },
            TaskViewItem {
                id: "t4".into(),
                title: "Run Security Audit".into(),
                status: "FAILED".into(),
                priority: "CRITICAL".into(),
                project_id: Some("proj-core".into()),
                assigned_agent: "Security Sentinel".into(),
                dependencies: vec!["t1".into()],
                ..Default::default()
            },
            TaskViewItem {
                id: "t5".into(),
                title: "Release Production Bundle".into(),
                status: "PENDING".into(),
                priority: "CRITICAL".into(),
                project_id: Some("proj-core".into()),
                assigned_agent: "Engineering Lead".into(),
                dependencies: vec!["t4".into()],
                ..Default::default()
            },
        ];

        (projects, tasks)
    }

    #[test]
    fn test_graph_status_distinction_waiting_vs_blocked() {
        let (projects, tasks) = create_test_projects_and_tasks();
        let agent_names = std::collections::HashMap::new();
        let graph = build_mission_graph(&projects, &tasks, &agent_names);

        // t1 is COMPLETED -> Done
        let n1 = graph.nodes.iter().find(|n| n.id == "t1").unwrap();
        assert_eq!(n1.status, GraphNodeStatus::Done);

        // t2 is IN_PROGRESS -> InProgress
        let n2 = graph.nodes.iter().find(|n| n.id == "t2").unwrap();
        assert_eq!(n2.status, GraphNodeStatus::InProgress);

        // t3 depends on t2 (InProgress) -> Waiting (NOT blocked, since t2 has not failed!)
        let n3 = graph.nodes.iter().find(|n| n.id == "t3").unwrap();
        assert_eq!(n3.status, GraphNodeStatus::Waiting);
        assert!(n3.blockers.is_empty());

        // t4 is FAILED -> Failed
        let n4 = graph.nodes.iter().find(|n| n.id == "t4").unwrap();
        assert_eq!(n4.status, GraphNodeStatus::Failed);

        // t5 depends on t4 (Failed) -> BLOCKED! Must identify t4 as the blocker!
        let n5 = graph.nodes.iter().find(|n| n.id == "t5").unwrap();
        assert_eq!(n5.status, GraphNodeStatus::Blocked);
        assert!(!n5.blockers.is_empty());
        assert!(n5.blockers[0].contains("Run Security Audit"));
    }

    #[test]
    fn test_downstream_impact_and_critical_blockers() {
        let (projects, tasks) = create_test_projects_and_tasks();
        let agent_names = std::collections::HashMap::new();
        let graph = build_mission_graph(&projects, &tasks, &agent_names);

        // t4 is FAILED and holds up t5 -> downstream_impact should be 1
        let n4 = graph.nodes.iter().find(|n| n.id == "t4").unwrap();
        assert_eq!(n4.downstream_impact, 1);
        assert!(graph.critical_blockers_count() >= 1);
    }

    #[test]
    fn test_cycle_detection_and_rejection() {
        let (_, tasks) = create_test_projects_and_tasks();

        // Valid addition: t5 depending on t3
        assert!(validate_dependency_addition(&tasks, "t5", "t3").is_ok());

        // Self dependency must be rejected
        assert!(validate_dependency_addition(&tasks, "t2", "t2").is_err());

        // Cycle: t1 depends on t2, but t2 already depends on t1 -> MUST reject cycle!
        let err = validate_dependency_addition(&tasks, "t1", "t2");
        assert!(err.is_err());
        assert!(err.unwrap_err().contains("Circular dependency rejected"));
    }

    #[test]
    fn test_graph_filtering_by_status_and_project() {
        let (projects, tasks) = create_test_projects_and_tasks();
        let agent_names = std::collections::HashMap::new();
        let mut graph = build_mission_graph(&projects, &tasks, &agent_names);

        // Filter by BLOCKED status (matches both blocked project root and blocked task)
        graph.filter_status = Some(GraphNodeStatus::Blocked);
        let blocked_indices = graph.filtered_indices();
        assert_eq!(blocked_indices.len(), 2);
        assert_eq!(graph.nodes[blocked_indices[0]].id, "proj-core");
        assert_eq!(graph.nodes[blocked_indices[1]].id, "t5");

        // Filter by project
        graph.filter_status = None;
        graph.filter_project = Some("Enterprise Core".into());
        let proj_indices = graph.filtered_indices();
        assert_eq!(proj_indices.len(), 6); // 1 project root + 5 tasks
    }

    #[test]
    fn test_render_docked_graph_pane() {
        let backend = TestBackend::new(40, 16);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();

        let (projects, tasks) = create_test_projects_and_tasks();
        state.projects = projects;
        state.tasks = tasks;
        state.rebuild_mission_graph();

        terminal
            .draw(|f| {
                let area = f.area();
                render_docked_graph_pane(f, &state, area);
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content = buffer
            .content()
            .iter()
            .map(|c| c.symbol())
            .collect::<Vec<_>>()
            .join("");

        assert!(content.contains("MISSION GRAPH"));
        assert!(content.contains("Enterprise"));
    }

    #[test]
    fn test_render_mission_graph_workspace() {
        let backend = TestBackend::new(140, 40);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut state = AppState::new();

        let (projects, tasks) = create_test_projects_and_tasks();
        state.projects = projects;
        state.tasks = tasks;
        state.rebuild_mission_graph();

        terminal
            .draw(|f| {
                let area = f.area();
                render_mission_graph_workspace(f, &state, area);
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content = buffer
            .content()
            .iter()
            .map(|c| c.symbol())
            .collect::<Vec<_>>()
            .join("");

        assert!(content.contains("MISSION & DEPENDENCY TOPOLOGY"));
        assert!(content.contains("Node Topology & Impact Inspector"));
        assert!(content.contains("DOWNSTREAM IMPACT"));
    }
}
