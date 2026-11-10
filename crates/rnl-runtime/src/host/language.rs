//! Netlist sections supplied by host adapters, independently of RNL versions (2.8).

use super::{HostDocument, LevelId, LevelKind};

/// The languages a record or a host object can reach. A shared net can have both.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub struct Languages(u8);

impl Languages {
    pub const NONE: Self = Self(0);
    pub const SPICE: Self = Self(1);
    pub const SPECTRE: Self = Self(2);
    pub const ALL: Self = Self(3);

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "spice" => Some(Self::SPICE),
            "spectre" => Some(Self::SPECTRE),
            _ => None,
        }
    }

    pub fn union(self, other: Self) -> Self {
        Self(self.0 | other.0)
    }

    pub fn intersect(self, other: Self) -> Self {
        Self(self.0 & other.0)
    }

    pub fn overlaps(self, other: Self) -> bool {
        self.intersect(other) != Self::NONE
    }
}

impl HostDocument {
    /// The host language of a line, as classified by its adapter. This does not inspect
    /// netlist syntax, use the RNL carrier, or infer a language from an instance name.
    pub fn language_at(&self, file: &str, line: u32) -> Languages {
        if self.in_spice_mode(file, line) {
            Languages::SPICE
        } else {
            Languages::SPECTRE
        }
    }

    /// Languages with a line in this level. A nested subcircuit owns its own lines;
    /// included file levels contribute to the circuit which includes them (2.6, 2.8).
    pub fn level_languages(&self, level: LevelId) -> Languages {
        let lv = &self.levels[level];
        if lv.kind == LevelKind::Package {
            return Languages::NONE;
        }
        let (first, last) = lv.section_lines.unwrap_or_else(|| {
            let end = if lv.end_line == 0 {
                self.sources
                    .iter()
                    .find(|(file, _)| file == &lv.file)
                    .map_or(lv.line.max(1), |(_, text)| text.lines().count() as u32)
            } else if lv.kind == LevelKind::Subckt {
                lv.end_line
            } else {
                lv.end_line.saturating_sub(1)
            };
            (lv.line.max(1), end)
        });
        // Split only at adapter-provided boundaries, rather than visiting each netlist line.
        let mut cuts = vec![first, last.saturating_add(1)];
        let mut excluded = Vec::new();
        for &child in &lv.children {
            let child = &self.levels[child];
            if child.kind == LevelKind::Subckt && child.file == lv.file {
                excluded.push((child.line, child.end_line));
            }
        }
        let file_level = self.file_level(level);
        for &(owner, start, end) in &self.unselected_sections {
            if owner == file_level {
                excluded.push((start, end));
            }
        }
        for &(start, end) in &excluded {
            cuts.extend([start, end.saturating_add(1)]);
        }
        for (file, start, end) in &self.spice_mode {
            if file == &lv.file {
                cuts.extend([start.saturating_add(1), end.saturating_add(1)]);
            }
        }
        cuts.retain(|line| *line >= first && *line <= last.saturating_add(1));
        cuts.sort_unstable();
        cuts.dedup();
        let mut found = Languages::NONE;
        for pair in cuts.windows(2) {
            let line = pair[0];
            if pair[1] > line && !excluded.iter().any(|(start, end)| *start <= line && line <= *end) {
                found = found.union(self.language_at(&lv.file, line));
            }
        }
        for &child in &lv.children {
            if self.levels[child].kind == LevelKind::File && !self.levels[child].circuit {
                found = found.union(self.level_languages(child));
            }
        }
        found
    }

    /// Every section which writes a net in a drawing level, including global declarations.
    pub fn net_languages(&self, level: LevelId, key: &str) -> Languages {
        self.net_language_index(level).get(key).copied().unwrap_or(Languages::NONE)
    }

    pub(crate) fn net_language_index(&self, level: LevelId) -> std::collections::HashMap<String, Languages> {
        let lv = &self.levels[level];
        let mut found = std::collections::HashMap::<String, Languages>::new();
        let mut add = |name: &str, file: &str, line: u32| {
            let mask = found.entry(self.net_key_in(level, name, file)).or_default();
            *mask = mask.union(self.language_at(file, line));
        };
        for inst in &lv.instances {
            for node in &inst.nodes {
                add(node, &inst.file, inst.line);
            }
        }
        for port in &lv.ports {
            add(port, &lv.file, lv.line);
        }
        for (name, loc) in &self.global_sites {
            add(name, &loc.file, loc.line);
        }
        found
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host::{Dialect, Instance, Level};

    fn mixed() -> HostDocument {
        let mut main = Level::new(LevelKind::File, "", "mixed.scs", "mixed.scs");
        main.circuit = true;
        main.end_line = 21;
        let mut doc = HostDocument::new(
            main,
            Dialect { name: "spectre".into(), case_sensitive: true, ground_aliases: vec!["0".into()] },
        );
        doc.spice_mode.push(("mixed.scs".into(), 5, 10));
        doc
    }

    #[test]
    fn section_boundaries_do_not_leak_between_parent_and_subcircuit() {
        let mut doc = mixed();
        assert_eq!(doc.language_at("mixed.scs", 5), Languages::SPECTRE);
        assert_eq!(doc.language_at("mixed.scs", 6), Languages::SPICE);
        assert_eq!(doc.language_at("mixed.scs", 10), Languages::SPICE);
        assert_eq!(doc.language_at("mixed.scs", 11), Languages::SPECTRE);
        assert_eq!(doc.level_languages(0), Languages::ALL);
        let mut sub = Level::new(LevelKind::Subckt, "child", "mixed.scs", "mixed.scs");
        sub.line = 6;
        sub.end_line = 10;
        let child = doc.add_level(sub, Some(0));
        assert_eq!(doc.level_languages(0), Languages::SPECTRE);
        assert_eq!(doc.level_languages(child), Languages::SPICE);
    }

    #[test]
    fn included_files_contribute_but_unselected_sections_do_not() {
        let mut doc = mixed();
        doc.unselected_sections.push((0, 6, 10));
        assert_eq!(doc.level_languages(0), Languages::SPECTRE);
        let mut included = Level::new(LevelKind::File, "", "child.sp", "child.sp");
        included.end_line = 3;
        doc.file_dialects.insert(
            "child.sp".into(),
            Dialect { name: "spice".into(), case_sensitive: false, ground_aliases: vec!["0".into()] },
        );
        doc.add_level(included, Some(0));
        assert_eq!(doc.level_languages(0), Languages::ALL);
    }

    #[test]
    fn shared_nets_include_instances_ports_and_global_declarations() {
        let mut doc = mixed();
        for (line, nodes) in [(3, vec!["shared", "spectre"]), (8, vec!["shared", "spice"])] {
            doc.levels[0].instances.push(Instance {
                file: "mixed.scs".into(),
                line,
                nodes: nodes.into_iter().map(String::from).collect(),
                ..Instance::default()
            });
        }
        assert_eq!(doc.net_languages(0, "shared"), Languages::ALL);
        assert_eq!(doc.net_languages(0, "spectre"), Languages::SPECTRE);
        assert_eq!(doc.net_languages(0, "spice"), Languages::SPICE);
        doc.add_global_at("spice", "mixed.scs", 12);
        assert_eq!(doc.net_languages(0, "spice"), Languages::ALL);
        doc.levels[0].line = 8;
        doc.levels[0].ports.push("spectre".into());
        assert_eq!(doc.net_languages(0, "spectre"), Languages::ALL);
        assert_eq!(doc.net_languages(0, "absent"), Languages::NONE);
    }
}
