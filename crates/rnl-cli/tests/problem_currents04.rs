//! Final current directions for solver consumers (8.2, 15.2).
use rnl_cli::interpret_file;
use rnl_runtime::diag::Severity;
use rnl_runtime::problem::{input_digest, PointRef};
use rnl_runtime::source::MemoryProvider;
use rnl_runtime::{Interpretation, Options};
use std::path::Path;

fn source(text: &str) -> Interpretation {
    interpret_file(
        Path::new("current.sp"),
        None,
        &MemoryProvider::new().with("current.sp", text),
        &Options { std: false, ..Options::solver() },
    )
    .unwrap()
}
fn read(version: &str, body: &str) -> Interpretation {
    source(&format!("* currents\n* @RNL(type=\"header\") {{ @VERSION(\"{version}\") }}\nR1 a b 1k\nR2 a b 2k\n* @RNL {{ {} }}\n.end\n", body.replace('\n', "\n* ")))
}
fn clean(r: &Interpretation) {
    let errors: Vec<_> = r.diagnostics().into_iter().filter(|d| d.severity == Severity::Error).collect();
    assert!(errors.is_empty(), "{errors:?}");
}
const PINS: &str =
    r#"$S = @DEFINE-SYMBOL { %p=(0,0) @PIN(terminal=1) => %alias; (0,4) @PIN(terminal=2) }; {#R1 #R2} @SET-SYMBOL $S"#;

#[test]
fn exports_final_terminal_directions_once_and_omits_unspecified() {
    let r = read(
        "0.4",
        &format!(
            r#"{PINS}; #R1:1 @CURRENT("in"); #R1::alias @CURRENT("out"); #R2:1 @CURRENT("in") => @CURRENT("unspecified")"#
        ),
    );
    clean(&r);
    let p = &r.problems[0];
    assert_eq!(p.currents.len(), 1);
    assert_eq!(p.currents[0].direction, "out");
    assert_eq!(p.ids.objects[p.currents[0].pin.pin_key().unwrap().0], "#R1");
    let json = rnl_cli::problem::level(p, "");
    assert_eq!(json["currents"][0]["direction"], "out");
    assert_eq!(json["currents"][0]["pin"]["terminal"], "p");
}

#[test]
fn terminal_current_uses_the_last_pin_even_when_an_earlier_pin_was_referenced() {
    let r = read(
        "0.4",
        r#"$S = @DEFINE-SYMBOL { %first=(0,0) @PIN(terminal=1); %last=(3,0) @PIN(terminal=1) }; #R1 @SET-SYMBOL $S; #R1::first @CURRENT("in")"#,
    );
    clean(&r);
    assert!(matches!(&r.problems[0].currents[0].pin,PointRef::Pin{pin:1,terminal,..} if terminal=="p"));
}

#[test]
fn omitted_pins_and_unspecified_currents_do_not_change_the_input() {
    for symbol in [
        "$S = @DEFINE-SYMBOL {}; #R1 @SET-SYMBOL $S",
        "$S = @DEFINE-SYMBOL { (0,0) @PIN(terminal=2) }; #R1 @SET-SYMBOL $S",
    ] {
        let plain = read("0.4", symbol);
        let marked = read("0.4", &format!(r#"{symbol}; #R1:1 @CURRENT("in")"#));
        clean(&marked);
        assert!(marked.problems[0].currents.is_empty());
        assert_eq!(input_digest(&plain.problems[0]), input_digest(&marked.problems[0]));
        assert!(rnl_cli::problem::level(&marked.problems[0], "").get("currents").is_none());
    }
    let empty = read("0.4", &format!(r#"{PINS}; #R1:1 @CURRENT("unspecified")"#));
    clean(&empty);
    assert!(empty.problems[0].currents.is_empty());
}

#[test]
fn disabled_and_failed_sources_cannot_replace_a_live_current() {
    for extra in [
        r#"$D = @DEFINE(roles=["t"]) { ?t @CURRENT("in") }; #R1::p @AS(priority="disabled") $D"#,
        r#"$D = @DEFINE(roles=[["t","pin"]]) { ?t @CURRENT("in") }; #R2:2 @AS $D"#,
    ] {
        let r = read(
            "0.4",
            &format!(
                r#"$S = @DEFINE-SYMBOL {{ %p=(0,0) @PIN(terminal=1) }}; {{#R1 #R2}} @SET-SYMBOL $S; #R1:1 @CURRENT("out"); {extra}"#
            ),
        );
        assert_eq!(r.problems[0].currents.len(), 1);
        assert_eq!(r.problems[0].currents[0].direction, "out");
    }
    let r=source(&format!("* disabled\n* @RNL(type=\"header\") {{ @VERSION(\"0.4\") }}\nR1 a b 1k\nR2 a b 1k\n* @RNL {{ {PINS}; #R1:1 @CURRENT(\"out\") }}\n* @RNL(priority=\"disabled\") {{ #R1:1 @CURRENT(\"in\") }}\n"));
    clean(&r);
    assert_eq!(r.problems[0].currents[0].direction, "out");
}

#[test]
fn generated_pin_currents_reach_the_final_solver_problem() {
    let r = read(
        "0.4",
        &format!(
            r#"{PINS}; $D = @DEFINE(roles=["t"]) {{ ?t @CURRENT("out") }}; #R1 @SELECT-PIN(terminal=1) => @AS $D"#
        ),
    );
    clean(&r);
    assert_eq!(r.problems[0].currents.len(), 1);
    assert_eq!(r.problems[0].currents[0].direction, "out");
}

#[test]
fn current_directions_affect_the_digest_but_source_locations_do_not() {
    let body = format!(r#"{PINS}; #R1:1 @CURRENT("in")"#);
    let a = read("0.4", &body);
    let b = read("0.4", &body.replace("CURRENT(\"in\")", "CURRENT(\"out\")"));
    let moved = read("0.4", &format!("\n\n{body}"));
    clean(&a);
    clean(&b);
    clean(&moved);
    assert_ne!(input_digest(&a.problems[0]), input_digest(&b.problems[0]));
    assert_eq!(input_digest(&a.problems[0]), input_digest(&moved.problems[0]));
}

#[test]
fn released_levels_keep_current_out_of_the_problem_and_digest() {
    for version in ["0.2", "0.3"] {
        let body = r#"$S = @DEFINE-SYMBOL { (0,0) @PIN(terminal=1) }; #R1 @SET-SYMBOL $S"#;
        let plain = read(version, body);
        let marked = read(version, &format!(r#"{body}; #R1:1 @CURRENT("in")"#));
        clean(&plain);
        clean(&marked);
        assert!(marked.problems[0].currents.is_empty());
        assert_eq!(rnl_cli::problem::level(&plain.problems[0], ""), rnl_cli::problem::level(&marked.problems[0], ""));
    }
}

#[test]
fn each_included_level_uses_its_own_version_for_the_interface() {
    for (outer, inner) in [("0.4", "0.3"), ("0.3", "0.4")] {
        let top = format!("* top\n* @RNL(type=\"header\") {{ @VERSION(\"{outer}\") }}\n.include child.sp\n");
        let child=format!("* child\n* @RNL(type=\"header\") {{ @VERSION(\"{inner}\") }}\n.subckt child a b\nR1 a b 1k\n* @RNL {{ $S = @DEFINE-SYMBOL {{ (0,0) @PIN(terminal=1) }}; #R1 @SET-SYMBOL $S; #R1:1 @CURRENT(\"in\") }}\n.ends\n");
        let files = MemoryProvider::new().with("current.sp", &top).with("child.sp", &child);
        let r = interpret_file(Path::new("current.sp"), None, &files, &Options { std: false, ..Options::solver() })
            .unwrap();
        clean(&r);
        let p = r.problems.iter().find(|p| p.name == "child").unwrap();
        assert_eq!(p.currents.len(), usize::from(inner == "0.4"));
    }
}

#[test]
fn a_port_on_the_subcircuit_symbol_is_not_a_pin_in_its_internal_drawing() {
    let r=source("* ports\n* @RNL(type=\"header\") { @VERSION(\"0.4\") }\n.subckt child a b\nR1 a b 1k\n* @RNL { $S = @DEFINE-SYMBOL { (0,0) @PIN(terminal=\"a\") }; # @SET-SYMBOL $S; #:a @CURRENT(\"in\") }\n.ends\n");
    clean(&r);
    let p = r.problems.iter().find(|p| p.name == "child").unwrap();
    assert!(p.currents.is_empty());
    let model = r.model.levels.iter().find(|p| p.name == "child").unwrap();
    assert!(model.currents.iter().any(|c| c.terminal == "#:a" && c.direction == "in"));
}
