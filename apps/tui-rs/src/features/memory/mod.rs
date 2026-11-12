pub mod model;
pub mod ui;

pub use model::{CompanyMemoryState, KnowledgeCategory, KnowledgeRecord, KnowledgeVerificationStatus};
pub use ui::{render_company_memory_workspace, render_docked_memory_pane};

use crate::app::AppState;

pub fn render_memory_tab(f: &mut ratatui::Frame, state: &AppState, area: ratatui::layout::Rect) {
    render_company_memory_workspace(f, state, area);
}

pub fn inspector_text(state: &AppState) -> Option<String> {
    state.company_memory_state.selected_record().map(|rec| {
        format!(
            "COMPANY MEMORY & INTELLIGENCE\n\n\
            ID: {}\n\
            Title: {}\n\
            Category: {}\n\
            Version: {}\n\
            Author: {}\n\
            Status: {}\n\
            Source: {}\n\
            Permissions: {}\n\
            Last Verified: {}\n\
            Consumers/Usage: {} location(s)\n\n\
            Summary: {}",
            rec.id,
            rec.title,
            rec.category.label(),
            rec.version,
            rec.author_or_agent,
            rec.status.as_str(),
            rec.source_reference,
            rec.required_permission,
            rec.last_verified_at.format("%Y-%m-%d %H:%M:%S UTC"),
            rec.usage_locations.len(),
            rec.summary
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::backend::TestBackend;
    use ratatui::Terminal;

    #[test]
    fn test_memory_search_and_filtering() {
        let mut mem = CompanyMemoryState::new();
        assert_eq!(mem.records.len(), 5);

        // Search by query
        mem.search_query = "speculative".into();
        let indices = mem.filtered_indices();
        assert_eq!(indices.len(), 1);
        assert_eq!(mem.records[indices[0]].id, "mem-104");

        // Filter by category
        mem.search_query.clear();
        mem.filter_category = Some(KnowledgeCategory::AgentSkill);
        let cat_indices = mem.filtered_indices();
        assert_eq!(cat_indices.len(), 1);
        assert_eq!(mem.records[cat_indices[0]].id, "mem-102");
    }

    #[test]
    fn test_provenance_and_stale_detection() {
        let mem = CompanyMemoryState::new();
        let stale = mem.records.iter().find(|r| r.status == KnowledgeVerificationStatus::Stale).unwrap();
        assert!(stale.status.badge().contains("STALE"));

        let unverified = mem.records.iter().find(|r| r.status == KnowledgeVerificationStatus::Unverified).unwrap();
        assert!(unverified.status.badge().contains("UNVERIFIED"));
    }

    #[test]
    fn test_access_control_and_usage_locations() {
        let mem = CompanyMemoryState::new();
        let skill = mem.records.iter().find(|r| r.id == "mem-102").unwrap();
        assert_eq!(skill.required_permission, "admin:governance");
        assert_eq!(skill.usage_locations.len(), 2);
    }

    #[test]
    fn test_render_docked_memory_pane() {
        let backend = TestBackend::new(80, 20);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut app_state = AppState::new();
        app_state.company_memory_state = CompanyMemoryState::new();

        terminal
            .draw(|f| {
                render_docked_memory_pane(f, &app_state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(content.contains("COMPANY MEMORY & INTELLIGENCE"));
        assert!(content.contains("mem-101"));
    }

    #[test]
    fn test_render_company_memory_workspace() {
        let backend = TestBackend::new(120, 30);
        let mut terminal = Terminal::new(backend).unwrap();
        let mut app_state = AppState::new();
        app_state.company_memory_state = CompanyMemoryState::new();

        terminal
            .draw(|f| {
                render_company_memory_workspace(f, &app_state, f.area());
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let content: String = buffer
            .content()
            .iter()
            .map(|cell| cell.symbol())
            .collect();

        assert!(content.contains("ORGANIZATIONAL INTELLIGENCE"));
        assert!(content.contains("CoreEngineerAgent"));
    }
}
