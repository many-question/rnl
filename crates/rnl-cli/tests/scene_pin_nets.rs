//! Symbol-dependent pin networks and the written references that reach them (6.5, 8.2).

use std::path::Path;

use rnl_cli::interpret_file;
use rnl_runtime::diag::{codes, Severity};
use rnl_runtime::markup::Run;
use rnl_runtime::model::TextTarget;
use rnl_runtime::problem::Filler;
use rnl_runtime::source::MemoryProvider;
use rnl_runtime::{Interpretation, Options};

fn read(body: &str) -> Interpretation {
    let body = body.replace('\n', "\n* ");
    let source =
        format!("* pin nets\n* @RNL(type=\"header\") {{ @VERSION(\"0.4\") }}\nR1 a b 1k\n* @RNL {{ {body} }}\n.end\n");
    interpret_file(
        Path::new("pins.sp"),
        None,
        &MemoryProvider::new().with("pins.sp", &source),
        &Options { std: false, ..Options::solver() },
    )
    .unwrap()
}

fn no_errors(r: &Interpretation) {
    assert!(!r.diagnostics().iter().any(|d| d.severity == Severity::Error), "{:?}", r.diagnostics());
}

#[test]
fn a_named_pin_net_fills_a_net_role_and_drives_a_wire_and_label() {
    let r = read(
        r#"
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN(terminal=1) };
        $B = @DEFINE-SYMBOL { (0,0) @CIRCLE(radius=1) };
        $D = @DEFINE(roles=[["n","net"]]) { ? @SET-SYMBOL $B; ? @TEXT("${n}") };
        %n = #R1::p::net; %n @AS $D => @PLACE(3,4);
        %n @WIRE {#R1::p (5,0)};
        %n @TEXT("network");
        #R1 @SET-SYMBOL $S => @PLACE(0,0)
    "#,
    );
    no_errors(&r);
    let p = &r.problems[0];
    assert_eq!(p.usages[0].roles[0].members, [Filler::Net("a".into())]);
    assert_eq!(p.wires.len(), 1);
    assert_eq!(p.wires[0].nets, ["a"]);
    let texts = &r.model.levels[0].texts;
    let role_label = texts.iter().find(|text| text.markup == "${n}").unwrap();
    assert!(matches!(&role_label.lines[0][0], Run::Text { text, .. } if text == "a"));
    let net_label = texts.iter().find(|text| text.markup == "network").unwrap();
    assert_eq!(net_label.target, Some(TextTarget::Net("a".into())));
}

#[test]
fn a_bus_pin_net_expands_in_a_set_role_and_in_a_wire() {
    let r = read(
        r#"
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN(terminal=[1,2]) };
        $D = @DEFINE(roles=[["{nets}","net"]]) {};
        #R1::p::net @AS $D;
        #R1::p::net @WIRE {#R1::p (5,0)};
        #R1 @SET-SYMBOL $S => @PLACE(0,0)
    "#,
    );
    no_errors(&r);
    assert_eq!(r.problems[0].usages[0].roles[0].members, [Filler::Net("a".into()), Filler::Net("b".into())]);
    assert_eq!(r.problems[0].wires[0].nets, ["a", "b"]);
    assert!(r.problems[0].wires[0].bus);
}

#[test]
fn a_bus_net_in_a_single_role_fails_late_without_creating_more_usages() {
    for terminals in ["[1]", "[1,2]"] {
        for role in [r#"["n","net"]"#, r#""n""#] {
            let body = r#"
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN(terminal=TERMINALS) };
        $D = @DEFINE(roles=[ROLE]) {};
        #R1::p::net @AS $D;
        #R1 @SET-SYMBOL $S
    "#
            .replace("ROLE", role)
            .replace("TERMINALS", terminals);
            let r = read(&body);
            assert!(r.diagnostics().iter().any(|d| d.code == codes::USAGE_ROLE_WRONG_KIND));
            assert!(r.problems[0].usages.is_empty());
            assert_eq!(r.model.levels[0].failed_usages.len(), 1);
        }
    }
}

#[test]
fn an_unbound_pin_has_no_net_and_dependent_creation_fails() {
    let r = read(
        r#"
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN };
        $D = @DEFINE(roles=["n"]) {};
        #R1::p::net @AS $D; #R1::p::net @WIRE {(0,0) (1,1)};
        &a @AS $D;
        #R1 @SET-SYMBOL $S
    "#,
    );
    assert!(r.diagnostics().iter().any(|d| d.code == codes::PIN_ON_NO_NET));
    assert_eq!(r.problems[0].usages.len(), 1);
    assert!(r.problems[0].wires.is_empty());
}

#[test]
fn a_usage_pin_net_follows_role_bindings_through_later_pin_references() {
    let r = read(
        r#"
        $D = @DEFINE(roles=["r"]) {};
        $N = @DEFINE(roles=[["n","net"]]) {};
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN(terminal="r") };
        %u = %v::p::net @AS $D;
        %v = #R1::x::net @AS $D;
        %u::p::net @AS $N;
        $R = @DEFINE-SYMBOL { %x = (0,0) @PIN(terminal=2) };
        #R1 @SET-SYMBOL $R;
        {%u %v} @SET-SYMBOL $S
    "#,
    );
    no_errors(&r);
    let u = r.problems[0].usages.iter().find(|u| u.definition == "$N").unwrap();
    assert_eq!(u.roles[0].members, [Filler::Net("b".into())]);
}

#[test]
fn a_pin_binding_a_single_member_set_role_still_has_a_bus_net() {
    let r = read(
        r#"
        $D = @DEFINE(roles=[["{r}","net"]]) {};
        $N = @DEFINE(roles=[["n","net"]]) {};
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN(terminal="r") };
        %u = {&a} @AS $D;
        %u::p::net @AS $N;
        %u @SET-SYMBOL $S
    "#,
    );
    assert!(r.diagnostics().iter().any(|d| d.code == codes::USAGE_ROLE_WRONG_KIND));
    assert!(r.problems[0].usages.iter().all(|u| u.definition != "$N"));
}

#[test]
fn pin_net_references_keep_the_network_text_offset_restriction() {
    let r = read(
        r#"
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN(terminal=1) };
        #R1::p::net @TEXT("bad",dx=1);
        #R1 @SET-SYMBOL $S => @PLACE(0,0)
    "#,
    );
    assert!(r.diagnostics().iter().any(|d| d.code == codes::TEXT_WIRE_NET_NO_OFFSET));
    assert!(r.model.levels[0].texts.iter().all(|t| t.markup != "bad"));
}

#[test]
fn net_values_do_not_merge_the_written_pin_names_used_by_union() {
    let r = read(
        r#"
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN(terminal=1) => %q };
        $D = @DEFINE(roles=[["n","net"]]) {};
        {#R1::p::net #R1::q::net #R1::p::net} @UNION => @AS $D;
        #R1 @SET-SYMBOL $S
    "#,
    );
    no_errors(&r);
    assert_eq!(r.problems[0].usages.len(), 2);
    for usage in &r.problems[0].usages {
        assert_eq!(usage.roles[0].members, [Filler::Net("a".into())]);
    }
}

#[test]
fn a_failed_network_reference_does_not_fail_an_independent_wire() {
    let r = read(
        r#"
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN };
        %invalid = #R1::p::net;
        %invalid @WIRE {(0,0) (1,1)};
        &a @WIRE {(0,0) (2,2)};
        #R1 @SET-SYMBOL $S
    "#,
    );
    assert_eq!(r.problems[0].wires.len(), 1);
    assert_eq!(r.problems[0].wires[0].nets, ["a"]);
    assert!(r.diagnostics().iter().any(|d| d.code == codes::PIN_ON_NO_NET));
}

#[test]
fn assertions_read_resolved_networks_and_report_real_violations() {
    let r = read(
        r#"
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN(terminal=1) };
        #R1::p::net @ASSERT-NET(name="a");
        #R1::p @ASSERT-NET(name="a");
        #R1::p::net @ASSERT-NET(name="b");
        #R1 @SET-SYMBOL $S
    "#,
    );
    no_errors(&r);
    assert_eq!(r.diagnostics().iter().filter(|d| d.severity == Severity::Violation).count(), 1);
    assert!(r.diagnostics().iter().any(|d| d.code == codes::VIOLATION_CONDITION));
}

#[test]
fn a_network_reference_is_a_selection_scope_after_symbols_are_given() {
    let r = read(
        r#"
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN(terminal=[1,2]) };
        $D = @DEFINE(roles=[["n","net"]]) {};
        #R1::p::net @SELECT-NET => @AS $D;
        #R1 @SET-SYMBOL $S
    "#,
    );
    no_errors(&r);
    assert_eq!(r.problems[0].usages.len(), 2);
    let nets: Vec<_> = r.problems[0].usages.iter().map(|usage| usage.roles[0].members.clone()).collect();
    assert_eq!(nets, [vec![Filler::Net("a".into())], vec![Filler::Net("b".into())]]);
}

#[test]
fn assertions_do_not_silently_drop_a_late_failed_reference() {
    let r = read(
        r#"
        $S = @DEFINE-SYMBOL { %p = (0,0) @PIN(terminal=1) };
        $D = @DEFINE(roles=[["r","instance"],["n","net"]]) {};
        %bad = #R1::p(r) &a(n) @AS $D;
        {%bad::n &b} @ASSERT-NET(name="b");
        #R1 @SET-SYMBOL $S
    "#,
    );
    assert!(r.diagnostics().iter().any(|d| d.code == codes::ASSERT_MEMBER_FAILED));
    assert!(!r.diagnostics().iter().any(|d| d.severity == Severity::Violation));
}
