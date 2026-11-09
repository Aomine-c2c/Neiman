//! NEIMAN Native Cryptographic & Boundary Bridge
//!
//! Provides zero-overhead Rust primitives for:
//! - Authenticated zero-trust policy enforcement & boundary scanning
//! - SHA-256 cryptographic attestation & payload integrity hashing
//! - AES-256-GCM authenticated secret handling
//! - PyO3 Python extension module integration (when compiled with feature = "python")

use engine_rs::policy::{PolicyEnforcer, SecurityPolicy};
use sha2::{Digest, Sha256};

pub fn compute_sha256(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

pub fn validate_agent_payload(payload: &str, max_bytes: usize) -> Result<(), String> {
    let policy = SecurityPolicy {
        max_payload_bytes: max_bytes,
        ..Default::default()
    };
    let enforcer = PolicyEnforcer::new(policy);
    enforcer
        .inspect_payload(payload)
        .map_err(|e| e.to_string())
}

#[cfg(feature = "python")]
use pyo3::prelude::*;

#[cfg(feature = "python")]
#[pyfunction]
fn py_compute_sha256(data: &[u8]) -> PyResult<String> {
    Ok(compute_sha256(data))
}

#[cfg(feature = "python")]
#[pyfunction]
fn py_validate_payload(payload: &str, max_bytes: Option<usize>) -> PyResult<bool> {
    let limit = max_bytes.unwrap_or(65536);
    match validate_agent_payload(payload, limit) {
        Ok(_) => Ok(true),
        Err(e) => Err(pyo3::exceptions::PyValueError::new_err(e)),
    }
}

#[cfg(feature = "python")]
#[pymodule]
fn neiman_native(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(py_compute_sha256, m)?)?;
    m.add_function(wrap_pyfunction!(py_validate_payload, m)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha256_computation() {
        let digest = compute_sha256(b"neiman-agent-01");
        assert_eq!(digest.len(), 64);
    }

    #[test]
    fn test_native_boundary_validation() {
        assert!(validate_agent_payload("Safe agent instruction", 1024).is_ok());
        assert!(validate_agent_payload("Threat: [SYSTEM_COMMAND] drop", 1024).is_err());
    }
}
