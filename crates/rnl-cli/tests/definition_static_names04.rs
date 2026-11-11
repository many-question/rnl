//! Definition-time placeholder and keyword checks also cover nested member sets (6.9, 6.10).
use rnl_cli::interpret_file;
use rnl_runtime::{
    diag::{codes, Code, Severity},
    source::MemoryProvider,
    Interpretation, Options,
};
use std::path::Path;

const CALLS: &str = "; #R1 @AS $D; #R2 @AS $D";
fn definition(body: &str) -> String {
    format!(r#"$D = @DEFINE(roles=["r"],parameters=[["distance",1]]) {{ {body} }}"#)
}
fn source(version: &str, body: &str, used: bool) -> String {
    let calls = if used { CALLS } else { "" };
    format!("* definitions\n* @RNL(type=\"header\") {{ @VERSION(\"{version}\") }}\nR1 a b 1k\nR2 a b 2k\n* @RNL {{ {}{calls} }}\n",definition(body))
}
fn files(provider: MemoryProvider) -> Interpretation {
    interpret_file(Path::new("main.sp"), None, &provider, &Options { std: false, ..Default::default() }).unwrap()
}
fn read(version: &str, body: &str, used: bool) -> Interpretation {
    files(MemoryProvider::new().with("main.sp", &source(version, body, used)))
}
fn errors(r: &Interpretation) -> Vec<Code> {
    r.diagnostics().iter().filter(|d| d.severity == Severity::Error).map(|d| d.code).collect()
}

#[test]
fn a_role_in_a_literal_is_wrong_even_without_an_application() {
    for body in ["(?r,0)", "?r @PLACE(x=?r)", "?r @ORIENT([?r])"] {
        for used in [false, true] {
            let r = read("0.4", body, used);
            assert_eq!(errors(&r), [codes::REF_HOLE_NOT_A_PARAM], "{body}/{used}: {:?}", r.diagnostics());
            let diagnostic = r.diagnostics().into_iter().find(|d| d.code == codes::REF_HOLE_NOT_A_PARAM).unwrap();
            assert!(diagnostic.message.contains("role ?r"));
            assert!(diagnostic.origin.is_empty());
            assert_eq!(diagnostic.loc.as_ref().unwrap().line, 5);
        }
    }
    for body in ["?r @PLACE(x=?missing)", "?r @ORIENT([?missing])"] {
        for used in [false, true] {
            let r = read("0.4", body, used);
            assert_eq!(errors(&r), [codes::REF_HOLE_NOT_A_PARAM], "{body}/{used}: {:?}", r.diagnostics());
        }
    }
}

#[test]
fn nested_keywords_and_pin_calls_are_checked_once() {
    for (body, code) in [
        ("{{?r @NOT-A-KEYWORD}}", codes::KEYWORD_UNKNOWN),
        ("{(0,0) @PIN(terminal=1)}", codes::DEFINE_BODY_PIN),
        ("{{ @VERSION }}", codes::KEYWORD_HEADER_ONLY),
    ] {
        for used in [false, true] {
            let r = read("0.4", body, used);
            assert_eq!(errors(&r), [code], "{body}/{used}: {:?}", r.diagnostics());
        }
    }
}

#[test]
fn header_keywords_fail_in_unused_definition_bodies() {
    for used in [false, true] {
        let r = read("0.4", "@VERSION", used);
        assert_eq!(errors(&r), [codes::KEYWORD_HEADER_ONLY], "{:?}", r.diagnostics());
    }
    assert!(errors(&read("0.3", "@VERSION", false)).is_empty());
}

#[test]
fn released_versions_keep_application_time_reports() {
    for version in ["0.2", "0.3"] {
        for body in ["(?r,0)", "{{?r @NOT-A-KEYWORD}}", "{(0,0) @PIN(terminal=1)}"] {
            assert!(errors(&read(version, body, false)).is_empty(), "{version}: {body}");
            let r = read(version, body, true);
            assert_eq!(errors(&r).len(), 2, "{version}: {body}: {:?}", r.diagnostics());
        }
    }
}

#[test]
fn separate_nested_occurrences_keep_their_own_diagnostics() {
    let r = read("0.4", "{{?r @NOT-A-KEYWORD}; {?r @NOT-A-KEYWORD}}", true);
    assert_eq!(errors(&r), [codes::KEYWORD_UNKNOWN, codes::KEYWORD_UNKNOWN], "{:?}", r.diagnostics());
    let offsets: Vec<_> = r
        .diagnostics()
        .iter()
        .filter(|d| d.code == codes::KEYWORD_UNKNOWN)
        .map(|d| d.loc.as_ref().unwrap().col)
        .collect();
    assert_ne!(offsets[0], offsets[1]);
}

#[test]
fn symbol_bodies_keep_their_own_pin_context() {
    for used in [false, true] {
        let r = read("0.4", "%s = @DEFINE-SYMBOL { (0,0) @PIN(terminal=1) }; ?r @SET-SYMBOL %s", used);
        assert!(errors(&r).is_empty(), "{:?}", r.diagnostics());
    }
}

#[test]
fn declared_parameters_and_strings_are_not_role_literals() {
    for used in [false, true] {
        let r = read("0.4", r#"?r @PLACE(x=?distance); ?r @TEXT("?r")"#, used);
        assert!(errors(&r).is_empty(), "{:?}", r.diagnostics());
    }
}

#[test]
fn an_included_definition_uses_its_source_language() {
    for (outer, inner, count) in [("0.3", "0.4", 1), ("0.4", "0.3", 2)] {
        let main = format!("* main\n* @RNL(type=\"header\") {{ @VERSION(\"{outer}\") }}\n.include child.sp\n");
        let child =
            source(inner, "(?r,0)", true).replace("R1 a b 1k", ".subckt child a b\nR1 a b 1k") + ".ends child\n";
        let r = files(MemoryProvider::new().with("main.sp", &main).with("child.sp", &child));
        assert_eq!(errors(&r).len(), count, "{outer}/{inner}: {:?}", r.diagnostics());
    }
}
