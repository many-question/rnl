//! Written sub-object handles determine creation before symbol-dependent conversion (5.2, 6.5, 8.2).

use std::path::Path;

use rnl_cli::interpret_file;
use rnl_runtime::diag::Severity;
use rnl_runtime::source::MemoryProvider;
use rnl_runtime::{Interpretation, Options};

fn read(body: &str, symbol_first: bool) -> Interpretation {
    let assignment = "#R1 @SET-SYMBOL $S;";
    let source = format!("* handles\n* @RNL(type=\"header\") {{ @VERSION(\"0.4\") }}\nR1 a b 1k\n* @RNL {{ $S = @DEFINE-SYMBOL {{ %p = (0,0) @PIN(terminal=1) => %q }}; $D = @DEFINE(roles=[\"r\"]) {{}}; {} {body}; {} }}\n.end\n", if symbol_first {assignment} else {""}, if symbol_first {""} else {assignment});
    let r = interpret_file(
        Path::new("handles.sp"),
        None,
        &MemoryProvider::new().with("handles.sp", &source),
        &Options { std: false, ..Options::solver() },
    )
    .unwrap();
    let errors: Vec<_> = r.diagnostics().into_iter().filter(|d| d.severity == Severity::Error).collect();
    assert!(errors.is_empty(), "{errors:?}");
    r
}

fn count(r: &Interpretation) -> usize {
    r.model.levels[0].objects.iter().filter(|o| o.definition.as_deref() == Some("$D")).count()
}

#[test]
fn different_names_of_one_pin_remain_two_members_before_and_after_assignment() {
    for symbol_first in [false, true] {
        assert_eq!(count(&read("{#R1::p #R1::q} @UNION => @AS $D", symbol_first)), 2);
    }
}

#[test]
fn repeating_the_same_parent_and_name_deduplicates() {
    assert_eq!(count(&read("{#R1::p #R1::p} @UNION => @AS $D", false)), 1);
}

#[test]
fn a_bound_reference_keeps_the_same_handle() {
    assert_eq!(count(&read("%alias = #R1::p; {%alias #R1::p #R1::q} @UNION => @AS $D", false)), 2);
}

#[test]
fn removing_one_name_does_not_remove_another_name_of_the_same_pin() {
    assert_eq!(count(&read("%s = {#R1::p #R1::q}; #R1::p @REMOVE-FROM %s; %s @AS $D", false)), 1);
}

#[test]
fn positions_keep_both_written_handles_and_repeated_positions() {
    assert_eq!(count(&read("%s = {#R1::p #R1::q}; %s{1,2,1} @AS $D", false)), 3);
}

#[test]
fn the_appearance_queue_sees_both_usages_created_from_written_handles() {
    let r = read("$BOX = @DEFINE-SYMBOL { (0,0) @CIRCLE(radius=1) }; {#R1::p #R1::q} @UNION => @AS $D; # @SELECT-USAGE $D => @SET-SYMBOL $BOX => @PLACE(5,0)", false);
    assert_eq!(count(&r), 2);
    let level = &r.model.levels[0];
    assert_eq!(level.items.iter().filter(|item| level.symbols[item.symbol].name == "$BOX").count(), 2);
}
