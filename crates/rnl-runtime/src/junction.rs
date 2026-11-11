//! The definition used by tools that add junction dots (13.2).
use crate::diag::{codes, Diag, Severity};
use crate::problem::SolverSetting;

/// Resolved in the target level, without applying a solver policy while reading.
/// Invalid settings are reported by the tool that requests dots, not by an ordinary viewer.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct JunctionConfig {
    /// A validated, writable definition reference, or no dots.
    pub definition: Option<String>,
    /// The setting that failed resolution. Kept for a consumer's located warning.
    pub invalid: Option<SolverSetting>,
}
impl JunctionConfig {
    pub fn warning(&self) -> Option<Diag> {
        let setting = self.invalid.as_ref()?;
        Some(Diag {
            severity: Severity::Warning,
            code: codes::JUNCTION_DEFINITION_INVALID,
            message: format!("junction={} must name a definition whose first role accepts a point in the target level; no dots are written (13.2)", setting.value.show()),
            loc: setting.source.clone(), cause: None, origin: String::new(), in_package: setting.package.clone(),
        })
    }
}
