//! Undrawn instances make drawing statements ineffective, not failed (9.2.8).
use rnl_cli::interpret_file;
use rnl_runtime::diag::{codes, Severity};
use rnl_runtime::problem::FactKind;
use rnl_runtime::source::MemoryProvider;
use rnl_runtime::{Interpretation, Options};
use std::path::Path;

fn read(version: &str, body: &str) -> Interpretation {
    let source = format!("* undrawn\n* @RNL(type=\"header\") {{ @VERSION(\"{version}\") }}\nM1 d g s b missing\nR1 g 0 1k\n* @RNL {{ $S = @DEFINE-SYMBOL {{ (0,0) @PIN(terminal=1,direction=\"right\"); (4,0) @PIN(terminal=2) }}; #R1 @SET-SYMBOL $S => @PLACE(2,0); {} }}\n.end\n",body.replace('\n', " "));
    interpret_file(
        Path::new("t.sp"),
        None,
        &MemoryProvider::new().with("t.sp", &source),
        &Options { std: false, ..Options::solver() },
    )
    .unwrap()
}
fn clean(result: &Interpretation) {
    assert!(!result.diagnostics().iter().any(|d| d.severity == Severity::Error), "{:?}", result.diagnostics());
}
#[test]
fn drawing_facts_on_an_undrawn_instance_do_not_reach_the_solver() {
    let baseline = read("0.4", "");
    for statement in
        ["#M1 @PLACE(10,20)", "#M1 @ORIENT(\"R90\")", "#M1:g @ORIENT(\"right\")", "#M1:g::position @PLACE(10,20)"]
    {
        let result = read("0.4", statement);
        clean(&result);
        assert_eq!(result.problems[0].facts.len(), baseline.problems[0].facts.len(), "{statement}");
        assert!(result
            .diagnostics()
            .iter()
            .any(|d| d.code == codes::SYMBOL_MODEL_CARD_MISSING && d.message.contains("have no effect")));
    }
}
#[test]
fn constraints_are_ignored_as_a_whole_without_poisoning_their_name() {
    for statement in [
        "{#R1 #M1} @ALIGN(\"y\")",
        "{#R1 #M1 (9,0)} @ORDER(\"left-to-right\")",
        " #M1:g #R1:1 @DISTANCE(\"left-to-right\",exact=1)",
        "#M1:g #R1:1 @ORIENT-RELATION(\"R0\")",
    ] {
        let result = read("0.4", &format!("%c = {statement}; %c @PRIORITY(\"high\")"));
        clean(&result);
        assert_eq!(result.model.levels[0].constraints.len(), 1, "{statement}");
        assert_eq!(result.model.levels[0].constraints[0].status, "ignored", "{statement}");
        assert!(
            result.problems[0]
                .facts
                .iter()
                .all(|f| matches!(f.kind, FactKind::Place { .. } | FactKind::PointCoordinate { .. })),
            "{statement}"
        );
    }
}
#[test]
fn wires_are_not_drawn_partially_and_do_not_fail() {
    let result = read("0.4", "&g {#R1:1 (6,0) #M1:g} @WIRE => %w; %w @TEXT(\"wire\")");
    clean(&result);
    assert!(result.problems[0].wires.is_empty());
    assert!(result.model.levels[0].wires.is_empty());
    assert!(result.model.levels[0].texts.is_empty());
}
#[test]
fn texts_and_graphics_on_undrawn_inputs_are_absent_even_with_explicit_positions() {
    for statement in [
        r#"#M1 @TEXT("hidden") => @PLACE(10,20)"#,
        r#"#M1:g @TEXT("hidden") => @PLACE(10,20)"#,
        r#"#M1 @TEXT("hidden",key="note") => @PLACE(10,20)"#,
        "#M1:g @CIRCLE(radius=1)",
    ] {
        let result = read("0.4", statement);
        clean(&result);
        assert!(result.model.levels[0].texts.is_empty(), "{statement}");
        assert!(result.model.levels[0].shapes.is_empty(), "{statement}");
        assert_eq!(result.problems[0].facts.len(), 2, "{statement}");
    }
}
#[test]
fn a_symbol_missing_a_terminal_still_fails() {
    for statement in ["#M1:g @TEXT(\"bad\")", "&g {#R1:1 #M1:g} @WIRE", "{#R1 #M1:g} @ALIGN(\"y\")"] {
        let result = read(
            "0.4",
            &format!("$P = @DEFINE-SYMBOL {{ (0,0) @PIN(terminal=\"d\") }}; #M1 @SET-SYMBOL $P; {statement}"),
        );
        assert!(
            result.diagnostics().iter().any(|d| d.severity == Severity::Error),
            "{statement}: {:?}",
            result.diagnostics()
        );
    }
}
#[test]
fn an_ignored_rewrite_keeps_the_previous_points_mode_and_style() {
    let result = read(
        "0.4",
        r##"&g {#R1:1 (6,0)} @WIRE(mode="straight",linecolor="#ff0000") => %w; %w {#M1:g (3,4)} @WIRE(mode="manhattan",linecolor="#0000ff"); %w @TEXT("kept")"##,
    );
    clean(&result);
    assert_eq!(result.problems[0].wires.len(), 1);
    assert_eq!(result.model.levels[0].wires.len(), 1);
    assert_eq!(result.model.levels[0].wires[0].points, [(2.0, 0.0), (6.0, 0.0)]);
    assert_eq!(result.model.levels[0].wires[0].style.get("linecolor").and_then(|v| v.str()), Some("#ff0000"));
}
#[test]
fn a_later_valid_rewrite_can_draw_a_wire_initially_ignored() {
    let result = read("0.4", "&g {#M1:g #R1:1} @WIRE => %w; %w {#R1:1 (6,0)} @WIRE");
    clean(&result);
    assert_eq!(result.problems[0].wires.len(), 1);
    assert_eq!(result.model.levels[0].wires.len(), 1);
}
#[test]
fn legacy_missing_pin_errors_remain() {
    for statement in ["#M1:g @TEXT(\"bad\")", "&g {#R1:1 #M1:g} @WIRE"] {
        let result = read("0.3", statement);
        assert!(result.diagnostics().iter().any(|d| d.severity == Severity::Error));
        assert!(result
            .diagnostics()
            .iter()
            .filter(|d| d.code == codes::SYMBOL_MODEL_CARD_MISSING)
            .all(|d| !d.message.contains("have no effect")));
    }
}

#[test]
fn the_statement_file_controls_the_exception_in_a_mixed_version_level() {
    for (writer, level) in [("0.4", "0.3"), ("0.3", "0.4")] {
        let files = MemoryProvider::new()
            .with("t.sp", &format!("* mixed\n* @RNL(type=\"header\") {{ @VERSION(\"{writer}\") }}\n.include inc.sp\n* @RNL(scope=\"child\") {{ #M1:g @TEXT(\"label\"); #M1 @PLACE(2,3); &g {{#M1:g (0,0) (4,0)}} @WIRE }}\n.end\n"))
            .with("inc.sp", &format!("* child\n* @RNL(type=\"header\") {{ @VERSION(\"{level}\") }}\n.subckt child g\nM1 d g s b missing\n.ends\n"));
        let result =
            interpret_file(Path::new("t.sp"), None, &files, &Options { std: false, ..Options::solver() }).unwrap();
        let failed = result.diagnostics().iter().any(|d| d.severity == Severity::Error);
        assert_eq!(failed, writer == "0.3", "{writer}/{level}: {:?}", result.diagnostics());
        if writer == "0.4" {
            assert!(result.problems.iter().all(|p| p.wires.is_empty()));
            assert!(result.model.levels.iter().all(|l| l.wires.is_empty() && l.texts.is_empty()));
        }
    }
}
#[test]
fn a_usage_keeps_its_own_point_when_a_role_is_an_undrawn_instance() {
    let result = read("0.4", "$D = @DEFINE(roles=[\"i\"]) {}; %u = #M1 @AS $D; %u @PLACE(10,20)");
    clean(&result);
    assert_eq!(result.problems[0].usages.len(), 1);
    assert_eq!(result.problems[0].facts.len(), 4);
}
#[test]
fn valid_drawing_is_preserved_when_a_symbol_is_explicitly_assigned() {
    let result=read("0.4", "$P = @DEFINE-SYMBOL { (0,0) @PIN(terminal=\"g\",direction=\"right\") }; #M1 @SET-SYMBOL $P => @PLACE(10,0); #M1:g @TEXT(\"shown\"); &g {#R1:1 #M1:g} @WIRE");
    clean(&result);
    assert_eq!(result.problems[0].wires.len(), 1);
    assert_eq!(result.model.levels[0].wires.len(), 1);
    assert_eq!(result.model.levels[0].texts.len(), 1);
}
#[test]
fn an_ignored_rewrite_does_not_hide_an_invalid_original_wire() {
    let result=read("0.4", "$P = @DEFINE-SYMBOL { (0,0) @PIN(terminal=1) }; #R1 @SET-SYMBOL $P; &g {#R1:2 (0,0)} @WIRE => %w; %w {#M1:g (2,0)} @WIRE");
    assert!(result.diagnostics().iter().any(|d| d.code == codes::WIRE_NO_PIN));
}

#[test]
fn an_ignored_key_text_layer_preserves_the_legacy_layer_and_position() {
    let files = MemoryProvider::new()
        .with("t.sp", "* mixed\n* @RNL(type=\"header\") { @VERSION(\"0.4\") }\n.include inc.sp\n* @RNL(scope=\"child\") { #M1 @TEXT(\"ignored\",key=\"note\") => @PLACE(30,40) }\n.end\n")
        .with("inc.sp", "* child\n* @RNL(type=\"header\") { @VERSION(\"0.3\") }\n.subckt child g\nM1 d g s b missing\n* @RNL { #M1 @PLACE(0,0); #M1 @TEXT(\"kept\",key=\"note\") => @PLACE(3,4) }\n.ends\n");
    let result = interpret_file(Path::new("t.sp"), None, &files, &Options { std: false, ..Options::solver() }).unwrap();
    clean(&result);
    let texts: Vec<_> = result.model.levels.iter().flat_map(|l| &l.texts).collect();
    assert_eq!(texts.len(), 1);
    assert_eq!(texts[0].markup, "kept");
}

#[test]
fn electrical_current_checks_still_see_undrawn_terminals() {
    let result = read("0.4", "#M1:g @CURRENT(\"in\"); #R1:1 @CURRENT(\"in\")");
    clean(&result);
    assert!(result.diagnostics().iter().any(|d| d.code == codes::VIOLATION_CURRENT_ONE_WAY));
}
#[test]
fn the_no_model_warning_also_explains_the_no_effect_rule() {
    let files=MemoryProvider::new().with("t.sp", "* missing model\n* @RNL(type=\"header\") { @VERSION(\"0.4\") }\nM1 d g s\n* @RNL { #M1:g @TEXT(\"ignored\"); #M1:g @ORIENT(\"right\") }\n.end\n");
    let result = interpret_file(Path::new("t.sp"), None, &files, &Options { std: false, ..Options::solver() }).unwrap();
    clean(&result);
    assert!(result
        .diagnostics()
        .iter()
        .any(|d| d.code == codes::SYMBOL_NO_MODEL && d.message.contains("have no effect")));
}
#[test]
fn an_ignored_wire_remains_in_the_creation_snapshot() {
    let result = read("0.4", "$D = @DEFINE(roles=[\"w\"]) {}; &g {#R1:1 #M1:g} @WIRE; # @SELECT-WIRE => @AS $D");
    clean(&result);
    assert_eq!(result.problems[0].usages.len(), 1);
    assert!(result.problems[0].wires.is_empty());
}
