use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineEvent {
    pub id: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

impl EngineEvent {
    pub fn new(event_type: impl Into<String>, payload: serde_json::Value) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            event_type: event_type.into(),
            payload,
            timestamp: Utc::now(),
        }
    }
}

pub struct EventDispatcher {
    sender: broadcast::Sender<EngineEvent>,
}

impl EventDispatcher {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<EngineEvent> {
        self.sender.subscribe()
    }

    pub fn dispatch(&self, event: EngineEvent) -> Result<usize, broadcast::error::SendError<EngineEvent>> {
        self.sender.send(event)
    }
}

impl Default for EventDispatcher {
    fn default() -> Self {
        Self::new(1024)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_event_dispatch_and_receive() {
        let dispatcher = EventDispatcher::new(16);
        let mut rx = dispatcher.subscribe();

        let event = EngineEvent::new("agent.state.changed", serde_json::json!({ "agent": "orchestrator", "state": "active" }));
        let _ = dispatcher.dispatch(event.clone());

        let received = rx.recv().await.expect("Failed to receive event");
        assert_eq!(received.event_type, "agent.state.changed");
        assert_eq!(received.payload["agent"], "orchestrator");
    }
}
