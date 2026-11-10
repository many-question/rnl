//! Definition-body level scopes and usage-local rule origins (6.9, 9.4, 10.4).
use rnl_cli::interpret_file;
use rnl_runtime::diag::Severity;
use rnl_runtime::source::MemoryProvider;
use rnl_runtime::{Interpretation, Options};
use std::path::Path;

fn read(version: &str, body: &str, child: &str) -> Interpretation {
    let source=format!("* definition scope\n* @RNL(type=\"header\") {{ @VERSION(\"{version}\") }}\n.subckt child p q\nR2 p q 1k\n* @RNL {{ {child} }}\n.ends child\nR1 a b 1k\nX1 a b child\n* @RNL {{ $S = @DEFINE-SYMBOL {{ (0,0) @PIN(terminal=1) }}; # @SELECT-INSTANCE(name=\"R*\",recursive=true) => @SET-SYMBOL $S; {body} }}\n.end\n");
    interpret_file(
        Path::new("t.sp"),
        None,
        &MemoryProvider::new().with("t.sp", &source),
        &Options { std: false, ..Options::solver() },
    )
    .unwrap()
}
fn clean(r: &Interpretation) {
    assert!(!r.diagnostics().iter().any(|d| d.severity == Severity::Error), "{:?}", r.diagnostics());
}
fn counts(r: &Interpretation) -> Vec<(usize, usize)> {
    r.problems
        .iter()
        .map(|p| {
            (
                p.usages.iter().filter(|u| u.definition == "$D").count(),
                p.objects.iter().filter(|o| o.text.as_ref().is_some_and(|t| t.key.as_deref() == Some("mark"))).count(),
            )
        })
        .collect()
}

#[test]
fn a_roleless_usage_runs_its_local_rule_without_becoming_inherited() {
    let r = read(
        "0.4",
        "$D = @DEFINE(roles=[]) { # @SELECT-INSTANCE(name=\"R*\") => @TEXT(\"mark\",key=\"mark\") }; $D @ATTACH",
        "",
    );
    clean(&r);
    assert_eq!(counts(&r), vec![(1, 1), (0, 0)]);
}

#[test]
fn a_recursive_body_rule_does_not_recreate_the_enclosing_usage() {
    let r=read("0.4","$D = @DEFINE(roles=[]) { # @SELECT-INSTANCE(name=\"R*\",recursive=true) => @TEXT(\"mark\",key=\"mark\") }; $D @ATTACH","");
    clean(&r);
    assert_eq!(counts(&r), vec![(1, 1), (0, 1)]);
}

#[test]
fn the_usage_level_is_the_body_rules_home() {
    let r = read(
        "0.4",
        "$D = @DEFINE(roles=[]) { # @SELECT-INSTANCE(name=\"R*\") => @TEXT(\"mark\",key=\"mark\") }",
        "$D @ATTACH",
    );
    clean(&r);
    assert_eq!(counts(&r), vec![(0, 0), (1, 1)]);
}

#[test]
fn definitions_with_roles_can_also_select_the_usage_level() {
    let r = read(
        "0.4",
        "$D = @DEFINE(roles=[\"x\"]) { # @SELECT-INSTANCE(name=\"R*\") => @TEXT(\"mark\",key=\"mark\") }; #R1 @AS $D",
        "",
    );
    clean(&r);
    assert_eq!(counts(&r), vec![(1, 1), (0, 0)]);
}

#[test]
fn released_definitions_still_reject_host_level_scopes() {
    let r =
        read("0.3", "$D = @DEFINE(roles=[]) { # @SELECT-INSTANCE => @TEXT(\"mark\",key=\"mark\") }; $D @ATTACH", "");
    assert!(r.diagnostics().iter().any(|d| d.severity == Severity::Error));
}

#[test]
fn named_host_objects_and_symbol_body_level_scopes_stay_forbidden() {
    for reference in ["#R1", "&a", "#:p"] {
        let r = read(
            "0.4",
            &format!("$D = @DEFINE(roles=[]) {{ {reference} @TEXT(\"mark\",key=\"mark\") }}; $D @ATTACH"),
            "",
        );
        assert!(r.diagnostics().iter().any(|d| d.severity == Severity::Error), "{reference}");
    }
    let r = read("0.4", "$BAD = @DEFINE-SYMBOL { # @SELECT-INSTANCE }", "");
    assert!(r.diagnostics().iter().any(|d| d.severity == Severity::Error));
}

#[test]
fn block_symbol_statements_are_rejected_once_even_without_an_application() {
    for application in ["", "$D @ATTACH; $D @ATTACH"] {
        for statement in ["# @SET-SYMBOL $S", "# => @SET-SYMBOL $S", "{# @SET-SYMBOL $S}"] {
            let r = read("0.4", &format!("$D = @DEFINE(roles=[]) {{ {statement} }}; {application}"), "");
            let errors: Vec<_> = r.diagnostics().into_iter().filter(|d| d.severity == Severity::Error).collect();
            assert_eq!(
                errors.iter().filter(|d| d.code.name() == "define-body-block-symbol").count(),
                1,
                "{statement}; {application}: {errors:?}"
            );
        }
    }
}

#[test]
fn named_body_selections_keep_their_reach_in_each_level() {
    let r=read("0.4","$D = @DEFINE(roles=[]) { %s=# @SELECT-INSTANCE(name=\"R*\",recursive=true); %s @TEXT(\"mark\",key=\"mark\") }; $D @ATTACH","");
    clean(&r);
    assert_eq!(counts(&r), vec![(1, 1), (0, 1)]);
}

#[test]
fn recursive_body_generation_does_not_take_a_host_role_into_another_level() {
    let r=read("0.4","$P = @DEFINE(roles=[\"a\",\"b\"]) {}; $D = @DEFINE(roles=[\"x\"]) { # @SELECT-INSTANCE(name=\"R*\",recursive=true) => $P @ATTACH ?x }; #R1 @AS $D","");
    clean(&r);
    let generated: Vec<_> =
        r.problems.iter().map(|p| p.usages.iter().filter(|u| u.definition == "$P").count()).collect();
    assert_eq!(generated, vec![1, 0]);
    assert!(r
        .diagnostics()
        .iter()
        .any(|d| d.severity == Severity::Warning && d.code.name() == "rule-uses-own-level-objects"));
}

#[test]
fn repeated_usages_have_independent_recursive_body_rules() {
    let r=read("0.4","$P = @DEFINE(roles=[\"x\"]) {}; $D = @DEFINE(roles=[]) { # @SELECT-INSTANCE(name=\"R*\",recursive=true) => @AS $P }; $D @ATTACH; $D @ATTACH","");
    clean(&r);
    let generated: Vec<_> =
        r.problems.iter().map(|p| p.usages.iter().filter(|u| u.definition == "$P").count()).collect();
    assert_eq!(generated, vec![2, 2]);
    assert_eq!(counts(&r), vec![(2, 0), (0, 0)]);
}

#[test]
fn a_host_role_used_only_as_a_selection_scope_is_empty_below_without_warning() {
    let r=read("0.4", "$P = @DEFINE(roles=[\"x\"]) {}; $D = @DEFINE(roles=[\"x\"]) { ?x @SELECT-INSTANCE(recursive=true) => @AS $P }; #R1 @AS $D", "");
    clean(&r);
    let generated: Vec<_> =
        r.problems.iter().map(|p| p.usages.iter().filter(|u| u.definition == "$P").count()).collect();
    assert_eq!(generated, vec![1, 0]);
    assert!(!r.diagnostics().iter().any(|d| d.code.name() == "rule-uses-own-level-objects"), "{:?}", r.diagnostics());
}

#[test]
fn a_forward_body_selection_is_rebound_in_the_descendant() {
    let r=read("0.4", "$D = @DEFINE(roles=[]) { %s @TEXT(\"mark\",key=\"mark\"); %s = # @SELECT-INSTANCE(name=\"R*\",recursive=true) }; $D @ATTACH", "");
    clean(&r);
    assert_eq!(counts(&r), vec![(1, 1), (0, 1)]);
}

#[test]
fn a_nested_usage_does_not_recur_when_its_body_rule_does() {
    let r=read("0.4", "$D = @DEFINE(roles=[]) { # @SELECT-INSTANCE(name=\"R*\",recursive=true) => @TEXT(\"mark\",key=\"mark\") }; $E = @DEFINE(roles=[]) { $D @ATTACH }; $E @ATTACH", "");
    clean(&r);
    assert_eq!(counts(&r), vec![(1, 1), (0, 1)]);
    assert_eq!(r.problems[1].usages.len(), 0);
}

#[test]
fn a_computed_level_cannot_receive_a_block_symbol_in_a_body() {
    let r = read("0.4", "$D = @DEFINE(roles=[]) { %level = #; %level @SET-SYMBOL $S }; $D @ATTACH; $D @ATTACH", "");
    assert_eq!(
        r.diagnostics().iter().filter(|d| d.code.name() == "define-body-block-symbol").count(),
        1,
        "{:?}",
        r.diagnostics()
    );
}

#[test]
fn a_collection_role_does_not_take_named_pins_to_a_descendant() {
    let r=read("0.4", "$S2 = @DEFINE-SYMBOL { %p=(0,0) @PIN(terminal=1) }; #R1 @SET-SYMBOL $S2; $P = @DEFINE(roles=[\"x\",\"{pins}\"]) {}; $D = @DEFINE(roles=[\"{pins}\"]) { # @SELECT-INSTANCE(name=\"R*\",recursive=true) => $P @ATTACH ?pins }; {#R1::p} @AS $D", "");
    clean(&r);
    let fills: Vec<_> = r
        .problems
        .iter()
        .map(|p| {
            p.usages
                .iter()
                .filter(|u| u.definition == "$P")
                .map(|u| u.roles.iter().find(|role| role.role == "pins").unwrap().members.len())
                .collect::<Vec<_>>()
        })
        .collect();
    assert_eq!(fills, vec![vec![1], vec![0]]);
}

#[test]
fn later_selection_edits_in_a_body_apply_in_each_reached_level() {
    let r=read("0.4", "$D = @DEFINE(roles=[]) { %s={}; %s @TEXT(\"mark\",key=\"mark\"); # @SELECT-INSTANCE(name=\"R*\",recursive=true) => @ADD-TO %s }; $D @ATTACH", "");
    clean(&r);
    assert_eq!(counts(&r), vec![(1, 1), (0, 1)]);
}

#[test]
fn inherited_body_rules_keep_the_application_order_among_outer_rules() {
    for (body, expected) in [
        ("# @SELECT-INSTANCE(name=\"R*\",recursive=true) => @TEXT(\"before\",key=\"mark\"); $D @ATTACH", "body"),
        ("$D @ATTACH; # @SELECT-INSTANCE(name=\"R*\",recursive=true) => @TEXT(\"after\",key=\"mark\")", "after"),
    ] {
        let r=read("0.4",&format!("$D = @DEFINE(roles=[]) {{ # @SELECT-INSTANCE(name=\"R*\",recursive=true) => @TEXT(\"body\",key=\"mark\") }}; {body}"), "");
        clean(&r);
        for p in &r.problems {
            let texts: Vec<_> =
                p.objects.iter().filter_map(|o| o.text.as_ref()).filter(|t| t.key.as_deref() == Some("mark")).collect();
            assert_eq!(texts.len(), 1);
            assert_eq!(rnl_runtime::markup::plain(&texts[0].lines[0]), expected);
        }
    }
}

#[test]
fn recursive_body_rules_also_reach_grandchildren_once() {
    let child = ".subckt grand p q\nR3 p q 1k\n.ends grand\nX2 p q grand";
    let source=format!("* nested\n* @RNL(type=\"header\") {{ @VERSION(\"0.4\") }}\n.subckt child p q\nR2 p q 1k\n{child}\n.ends child\nR1 a b 1k\nX1 a b child\n* @RNL {{ $D = @DEFINE(roles=[]) {{ # @SELECT-INSTANCE(name=\"R*\",recursive=true) => @TEXT(\"mark\",key=\"mark\") }}; $D @ATTACH }}\n.end\n");
    let r = interpret_file(
        Path::new("t.sp"),
        None,
        &MemoryProvider::new().with("t.sp", &source),
        &Options { std: false, ..Options::solver() },
    )
    .unwrap();
    clean(&r);
    assert_eq!(counts(&r), vec![(1, 1), (0, 1), (0, 1)]);
}

#[test]
fn an_inherited_package_body_warning_points_to_the_body() {
    let source = "* package body\n* @RNL(type=\"header\") { @VERSION(\"0.4\"); @USE-PACKAGE(name=\"defs\",version=\"1\",path=\"defs.rnl\") }\n.subckt child p q\nR2 p q 1k\n.ends child\nR1 a b 1k\nX1 a b child\n* @RNL { #R1 @AS $D }\n.end\n";
    let package = "@RNL(type=\"header\") { @VERSION(\"0.4\"); @PACKAGE(name=\"defs\",version=\"1\") }\n@RNL {\n$P = @DEFINE(roles=[\"a\",\"b\"]) {};\n$D = @DEFINE(roles=[\"x\"]) {\n# @SELECT-INSTANCE(name=\"R*\",recursive=true) => $P @ATTACH ?x\n}\n}\n";
    let r = interpret_file(
        Path::new("t.sp"),
        None,
        &MemoryProvider::new().with("t.sp", source).with("defs.rnl", package),
        &Options { std: false, ..Options::solver() },
    )
    .unwrap();
    clean(&r);
    let diagnostic = r.sink.all().iter().find(|d| d.code.name() == "rule-uses-own-level-objects").unwrap();
    assert_eq!(diagnostic.loc.as_ref().unwrap().file, "defs.rnl");
    assert_eq!(diagnostic.loc.as_ref().unwrap().line, 5);
    assert!(diagnostic.origin.contains("applying $D"));
    assert_eq!(diagnostic.in_package, "defs");
}

#[test]
fn a_mixed_body_scope_drops_only_the_foreign_role() {
    for scope in [
        "{?x; # @SELECT-INSTANCE(name=\"R*\",recursive=true)}",
        "{?x @SELECT-INSTANCE(recursive=true); # @SELECT-INSTANCE(name=\"R*\",recursive=true)}",
    ] {
        let r=read("0.4",&format!("$D = @DEFINE(roles=[\"x\"]) {{ {scope} @SELECT-INSTANCE => @TEXT(\"mark\",key=\"mark\") }}; #R1 @AS $D"), "");
        clean(&r);
        assert_eq!(counts(&r), vec![(1, 1), (0, 1)], "{scope}");
    }
}
