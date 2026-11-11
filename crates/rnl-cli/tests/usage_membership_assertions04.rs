//! Usage definition identity and set membership assertions (15.3).
use rnl_cli::interpret_file;
use rnl_runtime::{
    diag::{codes, Code, Severity},
    source::MemoryProvider,
    Interpretation, Options,
};
use std::path::Path;

fn read_version(version: &str, body: &str) -> Interpretation {
    let body = body.replace('\n', "\n* ");
    let source=format!("* assertions\n* @RNL(type=\"header\") {{ @VERSION(\"{version}\") }}\nR1 a b 1k\nR2 b c 2k\n* @RNL {{ {body} }}\n.end\n");
    interpret_file(
        Path::new("main.sp"),
        None,
        &MemoryProvider::new().with("main.sp", &source),
        &Options { std: false, problems: true, ..Default::default() },
    )
    .unwrap()
}
fn read(body: &str) -> Interpretation {
    read_version("0.4", body)
}
fn diagnostics(r: &Interpretation, severity: Severity) -> Vec<(Code, String)> {
    r.diagnostics().iter().filter(|d| d.severity == severity).map(|d| (d.code, d.message.clone())).collect()
}
fn check(body: &str) -> Vec<(Code, String)> {
    let r = read(body);
    assert!(diagnostics(&r, Severity::Error).is_empty(), "{:?}", r.diagnostics());
    diagnostics(&r, Severity::Violation)
}
const USAGES: &str = r#"$D = @DEFINE(roles=["x"]) {}; $E = @DEFINE(roles=["x"]) {};
    $ALIAS = $D; %a = #R1 @AS $D; %b = #R2 @AS $D; %c = #R1 @AS $E;"#;

#[test]
fn usages_match_definition_objects_including_aliases() {
    assert!(check(&format!("{USAGES} {{%a %b}} @ASSERT-USAGE $ALIAS")).is_empty());
    let result = check(&format!("{USAGES} {{%a %c}} @ASSERT-USAGE(message=\"required definition\") $D"));
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].0, codes::VIOLATION_USAGE_DEFINITION);
    assert!(result[0].1.contains("%c") && result[0].1.contains("required definition"));
}

#[test]
fn usage_same_and_different_compare_definitions_not_their_spelling() {
    for assertion in
        ["{%a %b} @ASSERT-USAGE(same=[\"definition\"])", "{%a %c} @ASSERT-USAGE(different=[\"definition\"])"]
    {
        assert!(check(&format!("{USAGES} {assertion}")).is_empty());
    }
    for (assertion, code) in [
        ("{%a %c} @ASSERT-USAGE(same=[\"definition\"])", codes::VIOLATION_SAME),
        ("{%a %b} @ASSERT-USAGE(different=[\"definition\"])", codes::VIOLATION_DIFFERENT),
    ] {
        let result = check(&format!("{USAGES} {assertion}"));
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].0, code);
    }
}

#[test]
fn usage_conditions_read_the_final_symbols() {
    let prefix = format!("{USAGES} $S = @DEFINE-SYMBOL {{ (0,0) @CIRCLE(radius=1) }}; %a @SET-SYMBOL $S;");
    assert!(check(&format!("{prefix} %a @ASSERT-USAGE(symbol=\"$S\", drawn=true); %b @ASSERT-USAGE(drawn=false)"))
        .is_empty());
    let result = check(&format!("{prefix} %b @ASSERT-USAGE(drawn=true)"));
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].0, codes::VIOLATION_CONDITION);
}

#[test]
fn usage_assertions_reject_other_kinds_and_attributes() {
    for (statement, code) in [
        ("#R1 @ASSERT-USAGE", codes::ASSERT_MEMBER_WRONG_KIND),
        ("%a @ASSERT-USAGE(same=[\"name\"])", codes::ASSERT_ATTRIBUTE_NOT_OF_KIND),
    ] {
        let r = read(&format!("{USAGES} {statement}"));
        assert_eq!(diagnostics(&r, Severity::Error).iter().map(|(c, _)| *c).collect::<Vec<_>>(), [code]);
        assert!(diagnostics(&r, Severity::Violation).is_empty());
    }
}

#[test]
fn membership_reports_missing_handles_and_the_authors_message() {
    assert!(check("#R1 @ASSERT-IN {#R1 #R2}").is_empty());
    let result = check("{#R1 #R2 #R2} @ASSERT-IN(message=\"check the group\") {#R1}");
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].0, codes::VIOLATION_IN);
    assert!(result[0].1.contains("#R2") && result[0].1.contains("check the group"));
    assert_eq!(result[0].1.matches("#R2").count(), 1);
}

#[test]
fn a_membership_target_must_really_be_a_set() {
    let r = read("#R1 @ASSERT-IN #R1");
    let errors = diagnostics(&r, Severity::Error);
    assert_eq!(errors.len(), 1);
    assert_eq!(errors[0].0, codes::SET_EDIT_TARGET_NOT_SET);
    assert!(diagnostics(&r, Severity::Violation).is_empty());
}

#[test]
fn membership_observes_late_edits_and_selection_dependent_targets() {
    assert!(check("%s={#R1}; #R2 @ASSERT-IN %s; #R2 @ADD-TO %s").is_empty());
    assert!(check("# @SELECT-INSTANCE => @ASSERT-IN %s; %s = # @SELECT-INSTANCE").is_empty());
    let result = check("%s={#R1 #R2}; #R2 @ASSERT-IN %s; #R2 @REMOVE-FROM %s");
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].0, codes::VIOLATION_IN);
}

#[test]
fn membership_keeps_named_pin_handles_but_roles_are_their_fillers() {
    let body = r#"$S = @DEFINE-SYMBOL { %p=(0,0) @PIN(terminal=1) => %q };
        #R1 @SET-SYMBOL $S;
        $D = @DEFINE(roles=["x"]) {}; %u = #R1 @AS $D;
        %u::x @ASSERT-IN {#R1}; #R1 @ASSERT-IN {%u::x};
        #R1::p @ASSERT-IN {#R1::q}"#;
    let result = check(body);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].0, codes::VIOLATION_IN);
    assert!(result[0].1.contains("#R1::p"));
}

#[test]
fn empty_inputs_hold_and_disabled_usages_are_not_checked() {
    assert!(check(
        r#"{} @ASSERT-IN {}; {} @ASSERT-USAGE;
        $D = @DEFINE(roles=["x"]) { ?x @ASSERT-IN {} };
        #R1 @AS $D => @PRIORITY("disabled")"#
    )
    .is_empty());
}

#[test]
fn assertions_in_bodies_report_the_application() {
    let result = check(r#"$D = @DEFINE(roles=["x"]) { ?x @ASSERT-IN {} }; %u = #R1 @AS $D"#);
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].0, codes::VIOLATION_IN);
    assert!(result[0].1.contains("%u") && result[0].1.contains("$D"));
}

#[test]
fn released_versions_do_not_accept_the_new_keywords() {
    for version in ["0.2", "0.3"] {
        for statement in ["#R1 @ASSERT-USAGE", "#R1 @ASSERT-IN {#R1}"] {
            let r = read_version(version, statement);
            assert!(!diagnostics(&r, Severity::Error).is_empty());
            assert!(diagnostics(&r, Severity::Violation).is_empty());
        }
    }
}
