//! Name checks also cover unused definitions and units without a drawing (6.6, 16.5).
use rnl_cli::interpret_file;
use rnl_runtime::diag::{codes, Code, Severity};
use rnl_runtime::source::MemoryProvider;
use rnl_runtime::{Interpretation, Options};
use std::path::Path;

fn read(files: &MemoryProvider, path: &str) -> Interpretation {
    interpret_file(Path::new(path), None, files, &Options { std: false, ..Options::solver() }).unwrap()
}
fn source(version: &str, header: &str, body: &str) -> String {
    format!(
        "* names\n* @RNL(type=\"header\") {{ @VERSION(\"{version}\"); {header} }}\nR1 a 0 1k\n* @RNL {{ {body} }}\n"
    )
}
fn package(version: &str, header: &str, body: &str) -> String {
    format!("@RNL(type=\"header\") {{ @VERSION(\"{version}\"); @PACKAGE(name=\"p\",version=\"1.0\"); {header} }}\n@RNL {{ {body} }}\n")
}
fn count(r: &Interpretation, code: Code) -> usize {
    r.diagnostics().iter().filter(|d| d.code == code).count()
}
const ALIAS: &str = "@ALIAS(\"input_role\",\"other_role\",definition=\"$D\")";
const DEF: &str = "$D = @DEFINE(roles=[\"input_role\"]) {}";

#[test]
fn unused_role_parameter_and_local_names_are_checked() {
    for (name, definition) in [
        ("input_role", DEF),
        ("gap", "$D = @DEFINE(roles=[],parameters=[[\"gap\",1]]) {}"),
        ("local", "$D = @DEFINE(roles=[]) { %local = (0,0) }"),
    ] {
        let alias = format!("@ALIAS(\"{name}\",\"other_name\",definition=\"$D\")");
        let r = read(&MemoryProvider::new().with("main.sp", &source("0.4", &alias, definition)), "main.sp");
        assert_eq!(count(&r, codes::ALIAS_SCOPED_LIKE_OWN_NAME), 1, "{:?}", r.diagnostics());
        let error = r.diagnostics().into_iter().find(|d| d.code == codes::ALIAS_SCOPED_LIKE_OWN_NAME).unwrap();
        assert_eq!(error.loc.as_ref().unwrap().line, 2);
        assert!(r.problems.iter().all(|p| p.usages.is_empty()));
    }
}

#[test]
fn standalone_and_imported_packages_report_duplicate_bindings() {
    let body = "$D = @DEFINE(roles=[]) {}; $D = @DEFINE(roles=[]) {}; $G = @DEFINE(roles=[\"i\"]) {}";
    let files = MemoryProvider::new()
        .with("p.rnl", &package("0.4", "", body))
        .with("main.sp", &source("0.4", "@USE-PACKAGE(name=\"p\",path=\"p.rnl\")", "#R1 @AS $G"));
    for path in ["p.rnl", "main.sp"] {
        let r = read(&files, path);
        assert_eq!(count(&r, codes::NAME_BOUND_TWICE), 1, "{:?}", r.diagnostics());
        let d = r.diagnostics().into_iter().find(|d| d.code == codes::NAME_BOUND_TWICE).unwrap();
        assert_eq!(d.in_package, "p");
        assert!(d.loc.as_ref().unwrap().file.ends_with("p.rnl"));
        if path == "main.sp" {
            assert_eq!(r.problems.iter().flat_map(|p| &p.usages).filter(|u| u.definition == "$G").count(), 1);
        }
    }
}

#[test]
fn repeating_the_same_binding_or_a_failed_value_adds_no_duplicate_error() {
    for body in ["$D = @DEFINE(roles=[]) {}; $D = $D", "$D = @DEFINE(roles=[]) {}; $D = $MISSING"] {
        let r = read(&MemoryProvider::new().with("p.rnl", &package("0.4", "", body)), "p.rnl");
        assert_eq!(count(&r, codes::NAME_BOUND_TWICE), 0, "{:?}", r.diagnostics());
    }
}

#[test]
fn aliases_of_imported_unused_definitions_are_checked_in_the_declaring_file() {
    let files = MemoryProvider::new()
        .with("p.rnl", &package("0.4", "", DEF))
        .with("main.sp", &source("0.4", &format!("{ALIAS}; @USE-PACKAGE(name=\"p\",path=\"p.rnl\")"), ""));
    let r = read(&files, "main.sp");
    assert_eq!(count(&r, codes::ALIAS_SCOPED_LIKE_OWN_NAME), 1, "{:?}", r.diagnostics());
    let d = r.diagnostics().into_iter().find(|d| d.code == codes::ALIAS_SCOPED_LIKE_OWN_NAME).unwrap();
    assert!(d.loc.as_ref().unwrap().file.ends_with("main.sp"));
}

#[test]
fn missing_definitions_and_originals_are_not_checked_eagerly() {
    for body in ["", "$D = @DEFINE(roles=[\"unrelated\"]) {}"] {
        let r = read(&MemoryProvider::new().with("main.sp", &source("0.4", ALIAS, body)), "main.sp");
        assert!(!r.diagnostics().iter().any(|d| d.severity == Severity::Error), "{:?}", r.diagnostics());
    }
}

#[test]
fn released_versions_keep_unused_declarations_unchanged() {
    for version in ["0.2", "0.3"] {
        let r = read(&MemoryProvider::new().with("main.sp", &source(version, ALIAS, DEF)), "main.sp");
        assert_eq!(count(&r, codes::ALIAS_SCOPED_LIKE_OWN_NAME), 0);
        let r = read(
            &MemoryProvider::new()
                .with("p.rnl", &package(version, "", "$D = @DEFINE(roles=[]) {}; $D = @DEFINE(roles=[]) {}")),
            "p.rnl",
        );
        assert_eq!(count(&r, codes::NAME_BOUND_TWICE), 0);
    }
}

#[test]
fn noncircuit_includes_and_packages_check_unused_names() {
    let files = MemoryProvider::new()
        .with("main.sp", &format!("{}\n.include defs.sp\n", source("0.4", "", "")))
        .with("defs.sp", "* definitions\n* @RNL(type=\"header\") { @VERSION(\"0.4\") }\n* @RNL { $D = @DEFINE(roles=[]) {}; $D = @DEFINE(roles=[]) {} }\n")
        .with("p.rnl", &package("0.4", ALIAS, DEF));
    let r = read(&files, "main.sp");
    assert_eq!(count(&r, codes::NAME_BOUND_TWICE), 1, "{:?}", r.diagnostics());
    let r = read(&files, "p.rnl");
    assert_eq!(count(&r, codes::ALIAS_SCOPED_LIKE_OWN_NAME), 1, "{:?}", r.diagnostics());
    assert_eq!(
        r.diagnostics().into_iter().find(|d| d.code == codes::ALIAS_SCOPED_LIKE_OWN_NAME).unwrap().in_package,
        "p"
    );
}

#[test]
fn aliases_follow_lower_level_definitions_and_other_bound_names() {
    let top = format!(
        "{}\n.subckt child a\nR2 a 0 2k\n* @RNL {{ {DEF} }}\n.ends child\n",
        source("0.4", ALIAS, "$D = @DEFINE(roles=[\"unrelated\"]) {}")
    );
    let r = read(&MemoryProvider::new().with("main.sp", &top), "main.sp");
    assert_eq!(count(&r, codes::ALIAS_SCOPED_LIKE_OWN_NAME), 1, "{:?}", r.diagnostics());
    let r = read(
        &MemoryProvider::new().with("main.sp", &source("0.4", &ALIAS.replace("$D", "$E"), &format!("{DEF}; $E = $D"))),
        "main.sp",
    );
    assert_eq!(count(&r, codes::ALIAS_SCOPED_LIKE_OWN_NAME), 1, "{:?}", r.diagnostics());
}

#[test]
fn included_declarations_follow_their_own_version_and_aliases_stay_in_their_file() {
    for (parent, child, expected) in [("0.3", "0.4", 1), ("0.4", "0.3", 0)] {
        let top = format!("{}\n.include defs.sp\n", source(parent, "", ""));
        let included = format!(
            "* definitions\n* @RNL(type=\"header\") {{ @VERSION(\"{child}\"); {ALIAS} }}\n* @RNL {{ {DEF} }}\n"
        );
        let r = read(&MemoryProvider::new().with("main.sp", &top).with("defs.sp", &included), "main.sp");
        assert_eq!(count(&r, codes::ALIAS_SCOPED_LIKE_OWN_NAME), expected, "{:?}", r.diagnostics());
    }
    let top = format!("{}\n.include defs.sp\n", source("0.4", ALIAS, ""));
    let included = format!("* definitions\n* @RNL(type=\"header\") {{ @VERSION(\"0.4\") }}\n.subckt child a\nR2 a 0 2k\n* @RNL {{ {DEF} }}\n.ends child\n");
    let r = read(&MemoryProvider::new().with("main.sp", &top).with("defs.sp", &included), "main.sp");
    assert_eq!(count(&r, codes::ALIAS_SCOPED_LIKE_OWN_NAME), 0, "{:?}", r.diagnostics());
}
