//! The public eda-style package is loaded from disk, without extending the core's built-ins.

use std::path::{Path, PathBuf};

use rnl_cli::{interpret_file, FsProvider};
use rnl_render::RenderOptions;
use rnl_runtime::diag::Severity;
use rnl_runtime::Options;

fn package_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../libraries/eda-style")
}

#[test]
fn package_and_gallery_check_and_render_without_errors_or_warnings() {
    let provider = FsProvider::new(&[package_dir()]);
    for name in ["eda-style.rnl", "eda-style-gallery.scs"] {
        let r = interpret_file(&package_dir().join(name), None, &provider, &Options::default()).unwrap();
        let problems: Vec<_> = r
            .diagnostics()
            .iter()
            .filter(|d| matches!(d.severity, Severity::Error | Severity::Warning))
            .map(|d| r.sink.render(d))
            .collect();
        assert!(problems.is_empty(), "{name}: {problems:?}");
        assert!(!r.model.levels.is_empty(), "{name}");
        for level in &r.model.levels {
            let svg = rnl_render::svg(level, &RenderOptions::default());
            assert!(svg.contains("<svg"), "{name}: {}", level.title);
        }
        if name.ends_with(".scs") {
            let svg = rnl_render::svg(&r.model.levels[0], &RenderOptions::default());
            assert!(svg.contains("#00cc66"));
            assert!(svg.contains("#ff0000"));
            assert!(svg.contains("font-family=\"Lucida Console, Monaco, DejaVu Sans Mono, Consolas, monospace\""));
            assert!(svg.contains("vector-effect=\"non-scaling-stroke\""));
        }
    }
}

#[test]
fn every_eda_style_symbol_has_its_pin_sides_on_its_outermost_pins() {
    let options = rnl_view::CatalogOptions { packages: Some(vec!["eda-style".into()]), ..Default::default() };
    let c = rnl_view::catalog(&FsProvider::new(&[package_dir()]), &options);
    assert_eq!(c.packages.len(), 1);
    assert_eq!(c.symbols.len(), 137);
    for s in &c.symbols {
        let [x1, y1, x2, y2] = s.bbox;
        for p in &s.pins {
            let [x, y] = p.at;
            assert!(x >= x1 && x <= x2 && y >= y1 && y <= y2, "{} pin {p:?} outside {:?}", s.symbol, s.bbox);
        }
        for (direction, axis, edge, minimum) in
            [("left", 0, x1, true), ("down", 1, y1, true), ("right", 0, x2, false), ("up", 1, y2, false)]
        {
            let pins = s.pins.iter().filter(|p| p.direction == Some(direction)).map(|p| p.at[axis]);
            let outermost = pins.reduce(if minimum { f64::min } else { f64::max });
            if let Some(pin) = outermost {
                assert_eq!(edge, pin, "{} {direction} box edge", s.symbol);
            }
        }
    }
}

#[test]
fn eda_style_is_absent_from_the_builtin_catalog() {
    let c = rnl_view::catalog(&FsProvider::new(&[]), &rnl_view::CatalogOptions::default());
    assert!(!c.packages.iter().any(|p| p.name == "eda-style"));
    assert!(!c.symbols.iter().any(|s| s.package == "eda-style"));
}
