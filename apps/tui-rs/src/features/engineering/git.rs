use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum WorkingTreeStatus {
    Clean,
    Modified,
    Untracked,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct FileChangeItem {
    pub path: String,
    pub status: String, // "M", "A", "D", "R", "??"
    pub additions: usize,
    pub deletions: usize,
    pub diff_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct CommitItem {
    pub sha: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct PullRequestItem {
    pub id: String,
    pub title: String,
    pub source_branch: String,
    pub target_branch: String,
    pub review_status: String, // "APPROVED", "CHANGES_REQUESTED", "PENDING_REVIEW"
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct TestExecutionReport {
    pub suite_name: String,
    pub status: String, // "PASSED", "FAILED", "RUNNING", "IDLE"
    pub total: usize,
    pub passed: usize,
    pub failed: usize,
    pub skipped: usize,
    pub coverage_pct: Option<f64>,
    pub execution_latency_ms: u64,
    pub failure_diagnostics: Vec<TestFailureDiagnostic>,
    pub raw_output: String,
    pub last_verified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct TestFailureDiagnostic {
    pub test_name: String,
    pub error_message: String,
    pub file_path: Option<String>,
    pub line_number: Option<usize>,
    pub stack_trace: String,
    pub related_task_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct SecurityScanSummary {
    pub status: String, // "CLEAN", "WARNING", "BLOCKED", "UNCONFIGURED"
    pub secrets_found: usize,
    pub cve_count: usize,
    pub red_line_violations: Vec<String>,
    pub scanned_at: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum EngineeringSection {
    #[default]
    Files,
    Diff,
    Tests,
    Commits,
}

impl EngineeringSection {
    pub fn next(&self) -> Self {
        match self {
            EngineeringSection::Files => EngineeringSection::Diff,
            EngineeringSection::Diff => EngineeringSection::Tests,
            EngineeringSection::Tests => EngineeringSection::Commits,
            EngineeringSection::Commits => EngineeringSection::Files,
        }
    }

    pub fn prev(&self) -> Self {
        match self {
            EngineeringSection::Files => EngineeringSection::Commits,
            EngineeringSection::Diff => EngineeringSection::Files,
            EngineeringSection::Tests => EngineeringSection::Diff,
            EngineeringSection::Commits => EngineeringSection::Tests,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct EngineeringExecutionState {
    pub repo_name: String,
    pub current_branch: String,
    pub working_tree_state: String,
    pub files_changed: Vec<FileChangeItem>,
    pub selected_file_idx: usize,
    pub diff_scroll: usize,
    pub recent_commits: Vec<CommitItem>,
    pub pull_requests: Vec<PullRequestItem>,
    pub current_task_id: Option<String>,
    pub current_task_title: Option<String>,
    pub assigned_agent: Option<String>,
    pub test_report: Option<TestExecutionReport>,
    pub security_scan: Option<SecurityScanSummary>,
    pub is_git_available: bool,
    pub git_error: Option<String>,
    pub active_section: EngineeringSection,
}

/// Executes a bounded, read-only Git subprocess command with a strict timeout and automatic process termination.
pub async fn run_bounded_git_cmd(
    repo_path: &Path,
    args: &[&str],
    timeout_ms: u64,
) -> Result<String, String> {
    if !repo_path.exists() {
        return Err(format!("Repository directory '{}' does not exist", repo_path.display()));
    }

    let mut cmd = tokio::process::Command::new("git");
    cmd.current_dir(repo_path);
    cmd.args(args);
    cmd.kill_on_drop(true);

    let child = cmd.output();
    match tokio::time::timeout(Duration::from_millis(timeout_ms), child).await {
        Ok(Ok(output)) => {
            if output.status.success() {
                Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
                Err(if err.is_empty() {
                    format!("Git exited with code {:?}", output.status.code())
                } else {
                    err
                })
            }
        }
        Ok(Err(e)) => Err(format!("Failed to spawn git process: {}", e)),
        Err(_) => Err(format!("Git command timed out after {}ms", timeout_ms)),
    }
}

/// Parses git status --porcelain=v1 output into FileChangeItems.
pub fn parse_porcelain_status(status_output: &str) -> Vec<FileChangeItem> {
    let mut items = Vec::new();
    for line in status_output.lines() {
        if line.len() < 3 {
            continue;
        }
        let status_code = line[..2].trim();
        let path_str = line[3..].trim().trim_matches('"').to_string();
        
        let normalized_status = if status_code.contains('M') {
            "M".to_string()
        } else if status_code.contains('A') {
            "A".to_string()
        } else if status_code.contains('D') {
            "D".to_string()
        } else if status_code.contains('R') {
            "R".to_string()
        } else if status_code == "??" {
            "??".to_string()
        } else {
            status_code.to_string()
        };

        items.push(FileChangeItem {
            path: path_str,
            status: normalized_status,
            additions: 0,
            deletions: 0,
            diff_content: String::new(),
        });
    }
    items
}

/// Parses git diff --numstat into map of file path -> (additions, deletions).
pub fn parse_numstat(numstat_output: &str) -> HashMap<String, (usize, usize)> {
    let mut map = HashMap::new();
    for line in numstat_output.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            let adds = parts[0].parse::<usize>().unwrap_or(0);
            let dels = parts[1].parse::<usize>().unwrap_or(0);
            let path = parts[2].trim().trim_matches('"').to_string();
            map.insert(path, (adds, dels));
        }
    }
    map
}

/// Parses git log formatted as %h|%an|%s|%ci into CommitItems.
pub fn parse_git_log(log_output: &str) -> Vec<CommitItem> {
    let mut commits = Vec::new();
    for line in log_output.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 4 {
            commits.push(CommitItem {
                sha: parts[0].trim().to_string(),
                author: parts[1].trim().to_string(),
                message: parts[2].trim().to_string(),
                timestamp: parts[3].trim().to_string(),
            });
        }
    }
    commits
}

/// Fetches the unified diff for a single file using bounded git subprocess.
pub async fn fetch_file_diff(repo_path: &Path, file_path: &str, timeout_ms: u64) -> String {
    let diff = run_bounded_git_cmd(repo_path, &["diff", "HEAD", "--", file_path], timeout_ms)
        .await
        .unwrap_or_default();
    if !diff.is_empty() {
        return diff;
    }
    // Check if it's an untracked file or newly staged file
    let full_path = repo_path.join(file_path);
    if full_path.is_file() {
        if let Ok(content) = tokio::fs::read_to_string(&full_path).await {
            let line_count = content.lines().count().max(1);
            let mut buf = format!("--- /dev/null\n+++ b/{}\n@@ -0,0 +1,{} @@\n", file_path, line_count);
            for line in content.lines().take(200) {
                buf.push('+');
                buf.push_str(line);
                buf.push('\n');
            }
            if content.lines().count() > 200 {
                buf.push_str(&format!("... [truncated {} lines]\n", content.lines().count() - 200));
            }
            return buf;
        }
    }
    String::new()
}

/// Inspects the local Git repository at `repo_path` using bounded read-only calls.
pub async fn inspect_local_git_repo(
    repo_path: &Path,
    timeout_ms: u64,
) -> Result<EngineeringExecutionState, String> {
    // 1. Verify repo root
    let inside_res = run_bounded_git_cmd(repo_path, &["rev-parse", "--is-inside-work-tree"], timeout_ms).await;
    if inside_res.is_err() || inside_res.as_deref() != Ok("true") {
        return Ok(EngineeringExecutionState {
            repo_name: repo_path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string(),
            current_branch: "unavailable".into(),
            working_tree_state: "Unavailable (Not a Git repository)".into(),
            is_git_available: false,
            git_error: Some("Target directory is not a Git repository or git binary is unavailable.".into()),
            ..Default::default()
        });
    }

    // 2. Branch name
    let branch = run_bounded_git_cmd(repo_path, &["rev-parse", "--abbrev-ref", "HEAD"], timeout_ms)
        .await
        .unwrap_or_else(|_| "main".to_string());

    // 3. Repo name from toplevel or dirname
    let toplevel = run_bounded_git_cmd(repo_path, &["rev-parse", "--show-toplevel"], timeout_ms).await;
    let repo_name = match toplevel {
        Ok(top) => Path::new(&top).file_name().and_then(|n| n.to_str()).unwrap_or("project").to_string(),
        Err(_) => repo_path.file_name().and_then(|n| n.to_str()).unwrap_or("project").to_string(),
    };

    // 4. File changes from status --porcelain
    let status_raw = run_bounded_git_cmd(repo_path, &["status", "--porcelain=v1"], timeout_ms).await.unwrap_or_default();
    let mut files_changed = parse_porcelain_status(&status_raw);

    // 5. Additions/Deletions counts via diff --numstat
    let numstat_raw = run_bounded_git_cmd(repo_path, &["diff", "HEAD", "--numstat"], timeout_ms).await.unwrap_or_default();
    let numstat_map = parse_numstat(&numstat_raw);
    for file in &mut files_changed {
        if let Some(&(adds, dels)) = numstat_map.get(&file.path) {
            file.additions = adds;
            file.deletions = dels;
        }
    }

    let working_tree_state = if files_changed.is_empty() {
        "Clean (Working tree synchronized)".to_string()
    } else {
        format!("Dirty ({} modified / untracked files)", files_changed.len())
    };

    // 6. Selected file diff (if any files exist)
    if let Some(first_file) = files_changed.first_mut() {
        first_file.diff_content = fetch_file_diff(repo_path, &first_file.path, timeout_ms).await;
    }

    // 7. Recent commits
    let log_raw = run_bounded_git_cmd(repo_path, &["log", "-n", "5", "--pretty=format:%h|%an|%s|%ci"], timeout_ms).await.unwrap_or_default();
    let recent_commits = parse_git_log(&log_raw);

    Ok(EngineeringExecutionState {
        repo_name,
        current_branch: branch,
        working_tree_state,
        files_changed,
        selected_file_idx: 0,
        diff_scroll: 0,
        recent_commits,
        pull_requests: vec![],
        current_task_id: None,
        current_task_title: None,
        assigned_agent: None,
        test_report: None,
        security_scan: None,
        is_git_available: true,
        git_error: None,
        active_section: EngineeringSection::Files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_porcelain_status() {
        let sample = " M apps/tui-rs/src/main.rs\nA  apps/tui-rs/src/git.rs\n D legacy/old.rs\n?? untracked.txt\n";
        let parsed = parse_porcelain_status(sample);
        assert_eq!(parsed.len(), 4);
        assert_eq!(parsed[0].path, "apps/tui-rs/src/main.rs");
        assert_eq!(parsed[0].status, "M");
        assert_eq!(parsed[1].path, "apps/tui-rs/src/git.rs");
        assert_eq!(parsed[1].status, "A");
        assert_eq!(parsed[2].path, "legacy/old.rs");
        assert_eq!(parsed[2].status, "D");
        assert_eq!(parsed[3].path, "untracked.txt");
        assert_eq!(parsed[3].status, "??");
    }

    #[test]
    fn test_parse_numstat() {
        let sample = "12\t4\tapps/tui-rs/src/main.rs\n45\t0\tnew_module.rs\n";
        let map = parse_numstat(sample);
        assert_eq!(map.len(), 2);
        assert_eq!(map.get("apps/tui-rs/src/main.rs"), Some(&(12, 4)));
        assert_eq!(map.get("new_module.rs"), Some(&(45, 0)));
    }

    #[test]
    fn test_parse_git_log() {
        let sample = "3a1bf2c|Alice Dev|Feat: add auth engine|2026-10-28 08:30:00 +0200\n9f8e7d6|Bob Lead|Fix: circuit breaker timeout|2026-10-28 08:15:00 +0200\n";
        let commits = parse_git_log(sample);
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].sha, "3a1bf2c");
        assert_eq!(commits[0].author, "Alice Dev");
        assert_eq!(commits[0].message, "Feat: add auth engine");
        assert_eq!(commits[1].sha, "9f8e7d6");
    }

    #[tokio::test]
    async fn test_inspect_local_git_repo_non_existent() {
        let res = inspect_local_git_repo(Path::new("/tmp/non_existent_sila_repo_xyz"), 500).await;
        assert!(res.is_ok());
        let state = res.unwrap();
        assert!(!state.is_git_available);
        assert!(state.git_error.is_some());
    }

    #[tokio::test]
    async fn test_inspect_local_git_repo_current_dir() {
        let current = std::env::current_dir().unwrap();
        let res = inspect_local_git_repo(&current, 2000).await;
        assert!(res.is_ok());
        let state = res.unwrap();
        assert!(state.is_git_available);
        assert!(!state.current_branch.is_empty());
        assert!(!state.repo_name.is_empty());
    }
}
