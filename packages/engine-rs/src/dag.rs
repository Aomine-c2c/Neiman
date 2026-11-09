use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TaskStatus {
    Pending,
    Running,
    Success,
    Failed(String),
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskNode {
    pub id: String,
    pub title: String,
    pub payload: String,
    pub dependencies: Vec<String>,
    pub status: TaskStatus,
}

impl TaskNode {
    pub fn new(title: impl Into<String>, payload: impl Into<String>, dependencies: Vec<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            title: title.into(),
            payload: payload.into(),
            dependencies,
            status: TaskStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub total_tasks: usize,
    pub completed_tasks: usize,
    pub failed_tasks: usize,
    pub task_statuses: HashMap<String, TaskStatus>,
}

#[derive(Default)]
pub struct TaskDag {
    nodes: HashMap<String, TaskNode>,
}

impl TaskDag {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
        }
    }

    pub fn add_node(&mut self, node: TaskNode) {
        self.nodes.insert(node.id.clone(), node);
    }

    pub fn get_node(&self, id: &str) -> Option<&TaskNode> {
        self.nodes.get(id)
    }

    /// Validates that there are no circular dependencies in the DAG
    pub fn validate_cycle_free(&self) -> Result<(), String> {
        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();

        for node_id in self.nodes.keys() {
            if !visited.contains(node_id) {
                if self.has_cycle_util(node_id, &mut visited, &mut rec_stack) {
                    return Err(format!("Circular dependency detected involving task: {}", node_id));
                }
            }
        }
        Ok(())
    }

    fn has_cycle_util(
        &self,
        node_id: &str,
        visited: &mut HashSet<String>,
        rec_stack: &mut HashSet<String>,
    ) -> bool {
        visited.insert(node_id.to_string());
        rec_stack.insert(node_id.to_string());

        if let Some(node) = self.nodes.get(node_id) {
            for dep in &node.dependencies {
                if !visited.contains(dep) {
                    if self.has_cycle_util(dep, visited, rec_stack) {
                        return true;
                    }
                } else if rec_stack.contains(dep) {
                    return true;
                }
            }
        }

        rec_stack.remove(node_id);
        false
    }

    /// Evaluates which nodes are ready for immediate execution (all dependencies completed successfully)
    pub fn get_executable_nodes(&self) -> Vec<String> {
        let mut ready = Vec::new();
        for (id, node) in &self.nodes {
            if node.status == TaskStatus::Pending {
                let all_deps_met = node.dependencies.iter().all(|dep_id| {
                    match self.nodes.get(dep_id) {
                        Some(dep) => dep.status == TaskStatus::Success,
                        None => false,
                    }
                });
                if all_deps_met {
                    ready.push(id.clone());
                }
            }
        }
        ready
    }

    /// Marks a node with its resulting execution status
    pub fn update_status(&mut self, id: &str, status: TaskStatus) {
        if let Some(node) = self.nodes.get_mut(id) {
            node.status = status;
        }
    }

    pub fn get_summary(&self) -> ExecutionResult {
        let mut completed = 0;
        let mut failed = 0;
        let mut statuses = HashMap::new();

        for (id, node) in &self.nodes {
            statuses.insert(id.clone(), node.status.clone());
            match node.status {
                TaskStatus::Success => completed += 1,
                TaskStatus::Failed(_) => failed += 1,
                _ => {}
            }
        }

        ExecutionResult {
            total_tasks: self.nodes.len(),
            completed_tasks: completed,
            failed_tasks: failed,
            task_statuses: statuses,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dag_dependency_resolution() {
        let mut dag = TaskDag::new();
        let node1 = TaskNode::new("Init context", "{}", vec![]);
        let n1_id = node1.id.clone();
        dag.add_node(node1);

        let node2 = TaskNode::new("Process data", "{}", vec![n1_id.clone()]);
        let n2_id = node2.id.clone();
        dag.add_node(node2);

        assert_eq!(dag.get_executable_nodes(), vec![n1_id.clone()]);

        // Complete task 1
        dag.update_status(&n1_id, TaskStatus::Success);
        assert_eq!(dag.get_executable_nodes(), vec![n2_id.clone()]);

        // Complete task 2
        dag.update_status(&n2_id, TaskStatus::Success);
        let summary = dag.get_summary();
        assert_eq!(summary.total_tasks, 2);
        assert_eq!(summary.completed_tasks, 2);
        assert_eq!(summary.failed_tasks, 0);
    }

    #[test]
    fn test_dag_cycle_detection() {
        let mut dag = TaskDag::new();
        let mut node1 = TaskNode::new("Task 1", "{}", vec![]);
        let mut node2 = TaskNode::new("Task 2", "{}", vec![]);
        node1.dependencies.push(node2.id.clone());
        node2.dependencies.push(node1.id.clone());

        dag.add_node(node1);
        dag.add_node(node2);

        assert!(dag.validate_cycle_free().is_err());
    }
}
