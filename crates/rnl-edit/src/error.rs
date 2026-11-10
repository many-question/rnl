//! Numbered edit refusals and diagnostics from reading the host netlist.

use rnl_runtime::diag::{Code, Sink};

/// Why no edit was written. The message stays separate from its stable diagnostic kind.
#[derive(Clone, Debug)]
pub struct Refusal {
    pub code: Code,
    pub message: String,
    /// Host diagnostics, including their locations and upstream causes.
    pub diagnostics: Vec<rnl_view::Diagnostic>,
}

impl Refusal {
    pub(crate) fn new(code: Code, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), diagnostics: Vec::new() }
    }

    pub(crate) fn context(mut self, prefix: impl std::fmt::Display) -> Self {
        self.message = format!("{prefix}: {}", self.message);
        self
    }
}

impl std::fmt::Display for Refusal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for Refusal {}

/// A completed edit and the host diagnostics collected while checking it.
#[derive(Clone, Debug)]
pub struct Written {
    pub text: String,
    pub diagnostics: Vec<rnl_view::Diagnostic>,
}

pub(crate) fn diagnostics(sink: &Sink) -> Vec<rnl_view::Diagnostic> {
    sink.all()
        .iter()
        .map(|d| {
            let (file, line, col) = d.loc.as_ref().map(|l| (l.file.clone(), l.line, l.col)).unwrap_or_default();
            rnl_view::Diagnostic {
                severity: d.severity.as_str(),
                code: d.code.number(),
                name: d.code.name(),
                file: file.clone(),
                full_path: file,
                file_index: None,
                line,
                col,
                message: d.message.clone(),
                origin: d.origin.clone(),
                cause: d.cause.map(|id| sink.render(sink.get(id))),
            }
        })
        .collect()
}
