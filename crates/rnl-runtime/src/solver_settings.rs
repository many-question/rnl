//! Literal tool overrides in the same text as SOLVER-CONFIG parentheses (14.10).
//! This API validates syntax only; the selected solver validates its own keys and values.

use crate::diag::codes;
use crate::interp::obj::{Lit, WStr};
use crate::problem::SolverSetting;
use crate::syntax::{parameter_text, ParseError, Value};
use std::collections::BTreeMap;

/// Parse explicit tool settings. There is no enclosing record, alias environment or source file.
/// Strings that name definitions are resolved in the target level by the consumer.
pub fn parse_overrides(text: &str) -> Result<Vec<SolverSetting>, ParseError> {
    let params = parameter_text(text)?;
    if !params.positional.is_empty() {
        return Err(ParseError {
            code: codes::PARAM_POSITIONAL_NOT_ALLOWED,
            message: "solver settings take named parameters, as key=value (14.10)".into(),
        });
    }
    fn literal(v: &Value, array: bool) -> Option<Lit> {
        Some(match v {
            Value::Num { value, .. } => Lit::Num(*value),
            Value::Str(s) => Lit::Str(WStr::new(s, None)),
            Value::Bool(b) => Lit::Bool(*b),
            Value::Arr(a) if !array => Lit::Arr(a.iter().map(|v| literal(v, true)).collect::<Option<_>>()?),
            _ => return None,
        })
    }
    params
        .named
        .into_iter()
        .map(|p| {
            let value = literal(&p.value, false).ok_or_else(|| ParseError {
                code: codes::SOLVER_CONFIG_VALUE_NOT_LITERAL,
                message: "a solver setting is a number, string, boolean, or flat array (14.10)".into(),
            })?;
            Ok(SolverSetting { key: p.name, value, source: None, package: String::new() })
        })
        .collect()
}

/// Merge only explicitly supplied tool values over file/package values, by key. Solver defaults
/// are not overrides. The returned order is canonical, independent of the tool's spelling order.
pub fn with_overrides(settings: &[SolverSetting], text: &str) -> Result<Vec<SolverSetting>, ParseError> {
    let overrides = parse_overrides(text)?;
    let mut values: BTreeMap<_, _> = settings.iter().cloned().map(|s| (s.key.clone(), s)).collect();
    for s in overrides {
        values.insert(s.key.clone(), s);
    }
    Ok(values.into_values().collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn literal_text_round_trips_and_preserves_open_keys() {
        let text = r#""custom-key"=[1, "two, )", true], junction="$DOT", grid=false, spacing_x=-2"#;
        let settings = parse_overrides(text).unwrap();
        let output = settings.iter().map(|s| format!("\"{}\"={}", s.key, s.value.show())).collect::<Vec<_>>().join(",");
        assert_eq!(parse_overrides(&output).unwrap(), settings);
        assert!(settings.iter().all(|s| s.source.is_none()));
        assert!(parse_overrides(" /* comment */ ").unwrap().is_empty());
    }

    #[test]
    fn nonliteral_or_extra_syntax_is_rejected_atomically() {
        for bad in [
            "1",
            "x=?param",
            "x=[[1]]",
            "x=word",
            "x=#R1",
            "x=1,x=2",
            "x=1); @SOLVER-CONFIG(y=2",
            "x=1) /*",
            "x=1;y=2",
            "x=1) blah (",
        ] {
            assert!(parse_overrides(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn only_written_overrides_replace_existing_values() {
        let original = parse_overrides("a=1,b=2").unwrap();
        let values = with_overrides(&original, "b=3,c=4").unwrap();
        assert_eq!(
            values.iter().map(|s| (s.key.as_str(), s.value.show())).collect::<Vec<_>>(),
            [("a", "1".into()), ("b", "3".into()), ("c", "4".into())]
        );
        assert_eq!(with_overrides(&original, "").unwrap(), original);
        assert!(with_overrides(&original, "b=9,c=?bad").is_err());
        assert_eq!(original[1].value, Lit::Num(2.0));
    }
}
