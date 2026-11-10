//! Record language qualifiers select host sections, without partitioning definitions (2.8).
use std::path::Path;

use rnl_cli::interpret_file;
use rnl_runtime::diag::{codes, Severity};
use rnl_runtime::source::MemoryProvider;
use rnl_runtime::{Interpretation, Options};

fn read(path: &str, text: &str) -> Interpretation {
    interpret_file(
        Path::new(path),
        None,
        &MemoryProvider::new().with(path, text),
        &Options { std: false, generated: true, ..Options::solver() },
    )
    .unwrap()
}

fn mixed(headers: &str, records: &str) -> Interpretation {
    read(
        "t.scs",
        &format!(
            r#"// sections
// @RNL(type="header") {{ @VERSION("0.4") }}
{headers}
Rs (shared s) resistor r=1k
simulator lang=spice
R1 shared p 2k
simulator lang=spectre
// @RNL {{ $S = @DEFINE-SYMBOL {{ (0,0) @PIN(terminal=1); (0,1) @PIN(terminal=2) }}; # @SELECT-INSTANCE => @SET-SYMBOL $S }}
{records}
"#
        ),
    )
}

fn errors(result: &Interpretation) -> Vec<String> {
    result.diagnostics().iter().filter(|d| d.severity == Severity::Error).map(|d| result.sink.render(d)).collect()
}

fn texts(result: &Interpretation) -> Vec<String> {
    result.problems[0]
        .objects
        .iter()
        .filter_map(|object| object.text.as_ref())
        .flat_map(|text| text.lines.iter().map(|line| rnl_runtime::markup::plain(line)))
        .collect()
}

#[test]
fn direct_references_and_selections_use_the_object_section() {
    let result = mixed(
        "",
        r#"
// @RNL(language="spice") { #Rs @TEXT("outside"); #R1 @TEXT("inside"); # @SELECT-INSTANCE => @TEXT("selected ${name}") }
"#,
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    let labels = texts(&result);
    assert!(labels.contains(&"inside".into()), "{labels:?}");
    assert!(labels.contains(&"selected R1".into()), "{labels:?}");
    assert!(!labels.iter().any(|s| s == "outside" || s == "selected Rs"), "{labels:?}");
}

#[test]
fn unknown_language_disables_the_record_instead_of_broadening_it() {
    let result = mixed("", r#"// @RNL(language="Spice") { #R1 @TEXT("wrong"); #missing @UNRECOGNIZED }"#);
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert!(result.diagnostics().iter().any(|d| d.code == codes::RECORD_HEADER_LANGUAGE_UNKNOWN));
    assert!(!texts(&result).contains(&"wrong".into()));
}

#[test]
fn generated_records_report_and_ignore_the_qualifier() {
    let result = mixed("", r#"// @RNL(type="generated", language="spice") { #Rs @TEXT("all") }"#);
    assert!(result.diagnostics().iter().any(|d| d.code == codes::RECORD_HEADER_LANGUAGE_GENERATED));
    assert!(texts(&result).contains(&"all".into()));
    let unknown = mixed("", r#"// @RNL(language="future", type="generated") { #Rs @TEXT("all") }"#);
    assert!(unknown.diagnostics().iter().any(|d| d.code == codes::RECORD_HEADER_LANGUAGE_GENERATED));
    assert!(!unknown.diagnostics().iter().any(|d| d.code == codes::RECORD_HEADER_LANGUAGE_UNKNOWN));
    assert!(texts(&unknown).contains(&"all".into()));
}

#[test]
fn qualified_headers_apply_device_declarations_only_to_their_language() {
    let result = mixed(
        r#"
// @RNL(type="header", language="spice") { @DEVICE(name="*", terminals=["p","n"]) }
// @RNL(type="header", language="spectre") { @DEVICE(name="*", terminals=["a","b"]) }
"#,
        r#"// @RNL { #R1:p @TEXT("spice"); #Rs:a @TEXT("spectre") }"#,
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert!(texts(&result).contains(&"spice".into()));
    assert!(texts(&result).contains(&"spectre".into()));
}

#[test]
fn a_second_header_for_the_same_language_is_ignored() {
    let result = mixed(
        r#"
// @RNL(type="header", language="spice") { @DEVICE(name="*", terminals=["p","n"]) }
// @RNL(type="header", language="spice") { @DEVICE(name="*", terminals=["x","y"]) }
"#,
        r#"// @RNL { #R1:p @TEXT("first") }"#,
    );
    assert!(result.diagnostics().iter().any(|d| d.code == codes::HEADER_RECORD_SECOND));
    assert_eq!(errors(&result).len(), 1, "{:?}", errors(&result));
    assert!(texts(&result).contains(&"first".into()));
}

#[test]
fn a_qualified_header_cannot_change_the_file_version_or_aliases() {
    let result = mixed(
        r#"// @RNL(type="header", language="spice") { @VERSION("0.3"); @ALIAS("foo","left"); @DEVICE(name="*", terminals=["p","n"]) }"#,
        r#"// @RNL { #R1:p @TEXT("still 0.4") }"#,
    );
    assert_eq!(result.diagnostics().iter().filter(|d| d.code == codes::HEADER_KEYWORD_NOT_ALLOWED).count(), 2);
    assert_eq!(errors(&result).len(), 2, "{:?}", errors(&result));
    assert!(texts(&result).contains(&"still 0.4".into()));
}

#[test]
fn an_absent_language_does_not_check_object_statements() {
    let result = read("t.sp", "* test\n* @RNL(type=\"header\") { @VERSION(\"0.4\") }\nR1 a b 1k\n* @RNL(language=\"spectre\") { #missing @UNRECOGNIZED }\n.end\n");
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
}

#[test]
fn missing_names_still_fail_in_a_present_language() {
    let result = mixed("", r#"// @RNL(language="spice") { #missing @TEXT("error") }"#);
    assert_eq!(errors(&result).len(), 1, "{:?}", errors(&result));
}

fn package_read(headers: &str, body: &str, packages: &[(&str, &str)]) -> Interpretation {
    let source = format!(
        r#"// package sections
// @RNL(type="header") {{ @VERSION("0.4"); {headers} }}
Rs (shared s) resistor r=1k
simulator lang=spice
R1 shared p 2k
simulator lang=spectre
{body}
"#
    );
    let mut provider = MemoryProvider::new().with("t.scs", &source);
    for (name, text) in packages {
        provider = provider.with(name, text);
    }
    interpret_file(Path::new("t.scs"), None, &provider, &Options { std: false, ..Options::solver() }).unwrap()
}

const PACKAGE: &str = r#"@RNL(type="header") { @VERSION("0.4"); @PACKAGE(name="p", version="1.0") }
@RNL { $S = @DEFINE-SYMBOL { (0,0) @PIN(terminal=1); (0,1) @PIN(terminal=2) }; # @SELECT-INSTANCE => @TEXT("package ${name}") }
"#;

#[test]
fn absent_sections_skip_header_device_and_package_body_checks() {
    let package = r#"@RNL(type="header") { @VERSION("0.4"); @PACKAGE(name="p", version="1.0") }
@RNL(type="header", language="spectre") { @DEVICE(name="*", terminals=[1]); @UNKNOWN }
@RNL(language="spectre") { # @PLACE(x=); $BAD = @DEFINE-SYMBOL { (0,0) @UNKNOWN }; $S = @DEFINE-SYMBOL { (0,0) @PIN(terminal=1) } }
"#;
    for spectre in [false, true] {
        let source = format!(
            r#"* optional section
* @RNL(type="header") {{ @VERSION("0.4"); @USE-PACKAGE(name="p", path="p.rnl") }}
* @RNL(type="header", language="spectre") {{ @DEVICE(name="*", terminals=[1]); @UNKNOWN }}
R1 a b 1k
* @RNL {{ #R1 @SET-SYMBOL $S }}
{}
"#,
            if spectre { "simulator lang=spectre\nRs (a b) resistor r=1k" } else { "" }
        );
        let provider = MemoryProvider::new().with("t.sp", &source).with("p.rnl", package);
        let result =
            interpret_file(Path::new("t.sp"), Some("spectre"), &provider, &Options { std: false, ..Options::solver() })
                .unwrap();
        if spectre {
            assert!(errors(&result).len() >= 4, "{:?}", errors(&result));
        } else {
            assert!(errors(&result).is_empty(), "{:?}", errors(&result));
            assert_eq!(result.problems[0].objects.iter().filter(|object| object.symbol.is_some()).count(), 1);
        }
    }
}

#[test]
fn package_device_headers_use_the_effective_language_intersection() {
    let package = r#"@RNL(type="header") { @VERSION("0.4"); @PACKAGE(name="p", version="1.0") }
@RNL(type="header", language="spice") { @DEVICE(name="*", terminals=["a","b"]) }
@RNL(type="header", language="spectre") { @DEVICE(name="*", terminals=["x","y"]) }
"#;
    let result = package_read(
        r#"@USE-PACKAGE(name="p", path="p.rnl")"#,
        r#"// @RNL { #R1:a @TEXT("spice"); #Rs:x @TEXT("spectre") }"#,
        &[("p.rnl", package)],
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert!(texts(&result).contains(&"spice".into()));
    assert!(texts(&result).contains(&"spectre".into()));
}

#[test]
fn an_inactive_package_use_does_not_check_its_object_records() {
    let package = r#"@RNL(type="header") { @VERSION("0.4"); @PACKAGE(name="p", version="1.0"); @DEVICE(name="*", terminals=[1]) }
@RNL { # @PLACE(x=); # @UNKNOWN; $S = @DEFINE-SYMBOL { (0,0) @PIN(terminal=1) } }
"#;
    let source = r#"* only SPICE
* @RNL(type="header") { @VERSION("0.4") }
* @RNL(type="header", language="spectre") { @USE-PACKAGE(name="p", path="p.rnl") }
R1 a b 1k
* @RNL { #R1 @SET-SYMBOL $S }
.end
"#;
    let provider = MemoryProvider::new().with("t.sp", source).with("p.rnl", package);
    let result =
        interpret_file(Path::new("t.sp"), None, &provider, &Options { std: false, ..Options::solver() }).unwrap();
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert_eq!(result.problems[0].objects.iter().filter(|o| o.symbol.is_some()).count(), 1);
}

#[test]
fn delayed_device_checks_do_not_turn_a_package_into_an_alias_package() {
    let package = r#"@RNL(type="header") { @VERSION("0.4"); @PACKAGE(name="p", version="1.0"); @ALIAS("@at","@PLACE"); @DEVICE(name="*", terminals=["a","b"]) }
"#;
    let result = package_read(
        r#"@USE-PACKAGE(name="p", path="p.rnl")"#,
        r#"// @RNL { #R1:a @TEXT("port") }"#,
        &[("p.rnl", package)],
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert!(texts(&result).contains(&"port".into()));
}

#[test]
fn duplicate_header_packages_compare_their_resolved_versions() {
    for (first, second, failed) in [
        (r#"path="p.rnl""#, r#"version="1.0", path="p.rnl""#, false),
        (r#"version="1.0", path="p.rnl""#, r#"path="p.rnl""#, false),
        (r#"version="1.0", path="missing.rnl""#, r#"version="1.0", path="p.rnl""#, true),
    ] {
        let result = package_read(
            "",
            &format!(
                r#"
// @RNL(type="header", language="spice") {{ @USE-PACKAGE(name="p", {first}) }}
// @RNL(type="header", language="spectre") {{ @USE-PACKAGE(name="p", {second}) }}
// @RNL {{ # @SELECT-INSTANCE => @SET-SYMBOL $S }}
"#
            ),
            &[("p.rnl", PACKAGE)],
        );
        assert_eq!(errors(&result).len(), usize::from(failed), "{:?}", errors(&result));
        assert_eq!(result.problems[0].objects.iter().filter(|o| o.symbol.is_some()).count(), 2);
        assert!(texts(&result).contains(&"package Rs".into()));
        assert_eq!(texts(&result).contains(&"package R1".into()), !failed);
    }
}

#[test]
fn duplicate_and_nonstring_languages_are_ignored_as_malformed_fields() {
    for fields in [r#"language="spice", language="spectre""#, "language=1"] {
        let result = mixed("", &format!(r#"// @RNL({fields}) {{ #Rs @TEXT("spectre"); #R1 @TEXT("spice") }}"#));
        assert_eq!(errors(&result).len(), 1, "{:?}", errors(&result));
        assert_eq!(texts(&result), ["spectre", "spice"]);
    }
}

#[test]
fn inline_header_packages_compare_content_without_whitespace() {
    for (body, conflict) in [("(0,0) @PIN(terminal=1)", false), ("(0,1) @PIN(terminal=1)", true)] {
        let result = mixed(
            &format!(r#"
// @RNL(type="header", language="spice") {{ @USE-PACKAGE(name="p") {{ $S = @DEFINE-SYMBOL {{ (0,0) @PIN(terminal=1) }} }} }}
// @RNL(type="header", language="spectre") {{ @USE-PACKAGE(name="p") {{ /* formatting */ $S=@DEFINE-SYMBOL {{ {body} }} }} }}
"#).replace("$S=@", "$S= @"),
            r#"// @RNL { # @SELECT-INSTANCE => @SET-SYMBOL $S }"#,
        );
        assert_eq!(errors(&result).len(), usize::from(conflict), "{:?}", errors(&result));
        assert_eq!(result.diagnostics().iter().any(|d| d.code == codes::HEADER_PACKAGE_LANGUAGE_CONFLICT), conflict);
        assert_eq!(result.problems[0].objects.iter().filter(|object| object.symbol.is_some()).count(), 2);
    }
}

#[test]
fn scope_and_included_sections_keep_their_nominal_reach() {
    let main = r#"// main Spectre section
// @RNL(type="header") { @VERSION("0.4") }
Rs (a b) resistor r=1k
include "child.sp"
// @RNL(language="spice") { # @SELECT-INSTANCE(recursive=true) => @TEXT("recursive ${name}") }
// @RNL(language="spice", scope="cell") { #R1 @TEXT("scoped") }
"#;
    let child = "* child\n.subckt cell a b\nR1 a b 1k\n.ends cell\n";
    let provider = MemoryProvider::new().with("t.scs", main).with("child.sp", child);
    let result =
        interpret_file(Path::new("t.scs"), None, &provider, &Options { std: false, ..Options::solver() }).unwrap();
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    let labels: Vec<_> = result
        .problems
        .iter()
        .flat_map(|p| &p.objects)
        .filter_map(|o| o.text.as_ref())
        .flat_map(|t| t.lines.iter().map(|line| rnl_runtime::markup::plain(line)))
        .collect();
    assert!(labels.contains(&"recursive R1".into()), "{labels:?}");
    assert!(labels.contains(&"scoped".into()), "{labels:?}");
    assert!(!labels.contains(&"recursive Rs".into()), "{labels:?}");
}

#[test]
fn subcircuit_ports_follow_the_opening_line_while_nets_follow_all_lines() {
    let result = read(
        "t.scs",
        r#"// mixed subcircuit
// @RNL(type="header") { @VERSION("0.4") }
subckt cell (a b)
// @RNL { $T = @DEFINE(roles=[["t","terminal"]]) {}; $N = @DEFINE(roles=[["n","net"]]) {} }
simulator lang=spice
R1 a b 1k
* @RNL(language="spice") { %wrong = #:a @AS $T; %net = &a @AS $N }
simulator lang=spectre
// @RNL(language="spectre") { %port = #:a @AS $T }
ends cell
"#,
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    let problem = result.problems.iter().find(|p| !p.usages.is_empty()).expect("net in SPICE section");
    assert_eq!(problem.usages.len(), 2);
}

#[test]
fn package_definitions_remain_visible_while_rules_follow_the_header_language() {
    let result = package_read(
        "",
        r#"
// @RNL(type="header", language="spice") { @USE-PACKAGE(name="p", path="p.rnl") }
// @RNL { # @SELECT-INSTANCE => @SET-SYMBOL $S }
"#,
        &[("p.rnl", PACKAGE)],
    );
    // Header records have to precede the host's records, but need not precede host lines.
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert_eq!(texts(&result), ["package R1"]);
    assert_eq!(result.problems[0].objects.iter().filter(|object| object.symbol.is_some()).count(), 2);
}

#[test]
fn identical_packages_in_qualified_headers_union_the_languages() {
    let result = package_read(
        "",
        r#"
// @RNL(type="header", language="spice") { @USE-PACKAGE(name="p", version="1.0", path="p.rnl") }
// @RNL(type="header", language="spectre") { @USE-PACKAGE(name="p", version="1.0", path="p.rnl") }
// @RNL { # @SELECT-INSTANCE => @SET-SYMBOL $S }
"#,
        &[("p.rnl", PACKAGE)],
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert_eq!(texts(&result), ["package Rs", "package R1"]);
}

#[test]
fn a_conflicting_qualified_package_does_not_replace_the_unqualified_one() {
    let result = package_read(
        r#"@USE-PACKAGE(name="p", version="1.0", path="p.rnl")"#,
        r#"
// @RNL(type="header", language="spice") { @USE-PACKAGE(name="p", version="2.0", path="missing.rnl") }
// @RNL { # @SELECT-INSTANCE => @SET-SYMBOL $S }
"#,
        &[("p.rnl", PACKAGE)],
    );
    assert_eq!(errors(&result).len(), 1, "{:?}", errors(&result));
    assert!(result.diagnostics().iter().any(|d| d.code == codes::HEADER_PACKAGE_LANGUAGE_CONFLICT));
    assert_eq!(texts(&result), ["package Rs", "package R1"]);
}

#[test]
fn language_masks_intersect_along_package_references() {
    let outer = r#"@RNL(type="header") { @VERSION("0.4"); @PACKAGE(name="outer", version="1.0") }
@RNL(type="header", language="spice") { @USE-PACKAGE(name="p", version="1.0", path="p.rnl") }
"#;
    let result = package_read(
        r#"@USE-PACKAGE(name="outer", path="outer.rnl")"#,
        r#"// @RNL { # @SELECT-INSTANCE => @SET-SYMBOL $S }"#,
        &[("p.rnl", PACKAGE), ("outer.rnl", outer)],
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert_eq!(texts(&result), ["package R1"]);
}

#[test]
fn cross_section_constraints_and_dependent_names_have_no_effect() {
    let result = mixed(
        "",
        r#"
// @RNL(language="spice") { %outside = #Rs; %outside @TEXT("dependent"); {#R1 #Rs} @ALIGN("x"); #R1 @TEXT("kept") }
"#,
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert_eq!(texts(&result), ["kept"]);
    assert!(!result.problems[0]
        .facts
        .iter()
        .any(|fact| matches!(fact.kind, rnl_runtime::problem::FactKind::Align { .. })));
}

#[test]
fn shared_nets_are_reached_from_both_languages() {
    let result = mixed(
        "",
        r#"
// @RNL { $D = @DEFINE(roles=[["n","net"]]) {} }
// @RNL(language="spice") { %sp = &shared @AS $D }
// @RNL(language="spectre") { %sc = &shared @AS $D }
"#,
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert_eq!(result.problems[0].usages.len(), 2);
}

#[test]
fn no_section_suppresses_syntax_checks_and_unused_definition_bodies() {
    let result = read(
        "t.sp",
        r#"* no Spectre section
* @RNL(type="header") { @VERSION("0.4") }
R1 a b 1k
* @RNL(language="spectre") { # @PLACE(x=); $BAD = @DEFINE-SYMBOL { (0,0) @UNKNOWN } }
.end
"#,
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
}

#[test]
fn definitions_from_a_dormant_record_can_be_named_in_another_section() {
    let result = read(
        "t.sp",
        r#"* definitions
* @RNL(type="header") { @VERSION("0.4") }
R1 a b 1k
* @RNL(language="spectre") { $S = @DEFINE-SYMBOL { (0,0) @PIN(terminal=1); (0,1) @PIN(terminal=2) } }
* @RNL { #R1 @SET-SYMBOL $S }
.end
"#,
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert_eq!(result.problems[0].objects.iter().filter(|object| object.symbol.is_some()).count(), 1);
}

#[test]
fn a_deferred_cross_section_constraint_is_ignored_as_a_whole() {
    let result = mixed(
        "",
        r#"
// @RNL { %all = # @SELECT-INSTANCE }
// @RNL(language="spice") { %c = %all @ALIGN("x"); %all @GROUP; &shared @WIRE {#R1:1 #Rs:1} }
"#,
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert!(!result.problems[0]
        .facts
        .iter()
        .any(|fact| matches!(fact.kind, rnl_runtime::problem::FactKind::Align { .. })));
    assert!(result.problems[0].wires.is_empty());
}

#[test]
fn unattached_points_belong_to_every_language_in_the_level() {
    let result = mixed(
        "",
        r#"
// @RNL { %p = (0,0) }
// @RNL(language="spice") { %p @TEXT("spice point") }
// @RNL(language="spectre") { %p @TEXT("spectre point") }
"#,
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert_eq!(texts(&result), ["spice point", "spectre point"]);
}

#[test]
fn usage_body_points_inherit_the_role_host_section() {
    let result = mixed(
        "",
        r#"
// @RNL { $D = @DEFINE(roles=[["x","instance"]]) { %p = (0,0) }; %sp = #R1 @AS $D; %sc = #Rs @AS $D }
// @RNL(language="spice") { %sp::p @TEXT("inside body"); %sc::p @TEXT("outside body") }
"#,
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert_eq!(texts(&result), ["inside body"]);
}

#[test]
fn package_use_masks_do_not_restrict_an_explicitly_applied_definition_body() {
    let package = r#"@RNL(type="header") { @VERSION("0.4"); @PACKAGE(name="p", version="1.0") }
@RNL { $D = @DEFINE(roles=[["x","instance"]]) { ?x @TEXT("body ${name}") } }
"#;
    let result = package_read(
        "",
        r#"
// @RNL(type="header", language="spice") { @USE-PACKAGE(name="p", path="p.rnl") }
// @RNL { #Rs @AS $D }
"#,
        &[("p.rnl", package)],
    );
    assert!(errors(&result).is_empty(), "{:?}", errors(&result));
    assert!(texts(&result).contains(&"body Rs".into()));
}

#[test]
fn language_checks_use_set_members_after_all_late_edits() {
    let removed = mixed(
        "",
        r#"
// @RNL { %a = {#Rs #R1} }
// @RNL(language="spice") { %a @TEXT("final ${name}") }
// @RNL { #Rs @REMOVE-FROM %a }
"#,
    );
    assert!(errors(&removed).is_empty(), "{:?}", errors(&removed));
    assert_eq!(texts(&removed), ["final R1"]);
    let added = mixed(
        "",
        r#"
// @RNL { %a = {#R1} }
// @RNL(language="spice") { %a @TEXT("should be inactive") }
// @RNL { #Rs @ADD-TO %a }
"#,
    );
    assert!(errors(&added).is_empty(), "{:?}", errors(&added));
    assert!(texts(&added).is_empty());
}

#[test]
fn usage_language_follows_final_members_of_collection_roles() {
    for edit in ["before", "after"] {
        let source = r#"
// @RNL { $D = @DEFINE(roles=["{members}"]) {}; $U = @DEFINE-SYMBOL { (0,0) @CIRCLE(radius=1) }; %s = {#R1 #Rs}; %u = %s @AS $D; BEFORE %u @SET-SYMBOL $U }
// @RNL(language="spice") { %u @TEXT("included") }
// @RNL(language="spectre") { %u @TEXT("excluded") }
// @RNL { AFTER }
"#.replace("BEFORE", if edit == "before" { "#Rs @REMOVE-FROM %s;" } else { "" })
 .replace("AFTER", if edit == "after" { "#Rs @REMOVE-FROM %s" } else { "" });
        let result = mixed("", &source);
        assert!(errors(&result).is_empty(), "{:?}", errors(&result));
        assert!(
            texts(&result).contains(&"included".into()),
            "{:?}\n{:?}\n{:?}",
            texts(&result),
            result.problems[0].usages,
            result.diagnostics()
        );
        assert!(!texts(&result).contains(&"excluded".into()), "{:?}", texts(&result));
    }
}

#[test]
fn qualified_forward_symbol_expansion_keeps_the_existing_depth_limit() {
    for levels in [64, 65] {
        let mut body = format!("#R1 @SET-SYMBOL $S{};\n", levels - 1);
        for n in (1..levels).rev() {
            body.push_str(&format!("$S{n} = @DEFINE-SYMBOL {{ $MARK @ATTACH (1,2) => @SET-SYMBOL $S{} }};\n", n - 1));
        }
        body.push_str("$S0 = @DEFINE-SYMBOL { (0,0) @CIRCLE(radius=1) }; $MARK = @DEFINE(roles=[\"at\"]) {}; (100,100) @TEXT(\"independent\")");
        let source = format!(
            "* deep qualified symbols\n* @RNL(type=\"header\") {{ @VERSION(\"0.4\") }}\nR1 a b 1k\n* @RNL(language=\"spice\") {{\n{}\n* }}\n.end\n",
            body.lines().map(|line| format!("* {line}")).collect::<Vec<_>>().join("\n")
        );
        let result = read("deep.sp", &source);
        let diagnostics = errors(&result);
        if levels == 64 {
            assert!(diagnostics.is_empty(), "{diagnostics:?}");
        } else {
            assert!(diagnostics.iter().any(|d| d.contains("limit of 64 active symbol bodies")), "{diagnostics:?}");
        }
        assert!(texts(&result).contains(&"independent".into()));
    }
}
