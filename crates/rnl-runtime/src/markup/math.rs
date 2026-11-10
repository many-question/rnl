//! The formula subset of 13.6. Attribute expansions are opaque atoms.

use super::{codes, name_group, symbol, Code, Run, RunStyle, LITERAL};

/// Find the matching math delimiter, skipping literal attribute values and escaped slashes.
pub(super) fn end(t: &[char], mut i: usize) -> Option<usize> {
    while i < t.len() {
        if t[i] == LITERAL {
            i = (i + 1..t.len()).find(|&j| t[j] == LITERAL)? + 1;
        } else if t[i] == '\\' {
            if t.get(i + 1) == Some(&')') {
                return Some(i);
            }
            i += 2;
        } else {
            i += 1;
        }
    }
    None
}

fn shown(t: &[char]) -> String {
    t.iter().copied().filter(|c| *c != LITERAL).collect()
}

fn push(out: &mut Vec<Run>, text: String, style: RunStyle) {
    if text.is_empty() {
        return;
    }
    if let Some(Run::Text { text: previous, style: before }) = out.last_mut() {
        if *before == style {
            previous.push_str(&text);
            return;
        }
    }
    out.push(Run::Text { text, style });
}

fn upright(mut style: RunStyle) -> RunStyle {
    style.italic = false;
    style.upright = true;
    style
}

pub(super) fn parse(t: &[char], style: RunStyle) -> (Vec<Run>, Vec<(Code, String)>) {
    let mut p = Math { problems: Vec::new(), depth: 0 };
    let runs = p.sequence(t, style, false);
    (runs, p.problems)
}

struct Math {
    problems: Vec<(Code, String)>,
    depth: usize,
}

impl Math {
    fn too_deep(&mut self, t: &[char], style: RunStyle) -> Vec<Run> {
        self.problems.push((codes::MARKUP_MATH_DEPTH,
            "math nesting exceeds the implementation limit of 64 levels; the remaining formula is shown as written (13.6)".into()));
        vec![Run::Text { text: shown(t), style: upright(style) }]
    }

    fn unknown(&mut self, out: &mut Vec<Run>, t: &[char], style: RunStyle) {
        let text = shown(t);
        self.problems.push((codes::MARKUP_UNKNOWN_COMMAND, format!("unknown markup {text} is shown as written")));
        push(out, text, upright(style));
    }

    fn sequence(&mut self, t: &[char], style: RunStyle, roman: bool) -> Vec<Run> {
        // A bound keeps malformed or deeply nested text from exhausting the reader's stack.
        if self.depth == 64 {
            return self.too_deep(t, style);
        }
        self.depth += 1;
        let mut out = Vec::new();
        let mut i = 0;
        while i < t.len() {
            i = self.atom(t, i, style, roman, &mut out);
        }
        self.depth -= 1;
        out
    }

    fn atom(&mut self, t: &[char], mut i: usize, style: RunStyle, roman: bool, out: &mut Vec<Run>) -> usize {
        while t.get(i).is_some_and(|c| c.is_whitespace()) {
            i += 1;
        }
        let Some(&c) = t.get(i) else { return i };
        if c == LITERAL {
            let end = (i + 1..t.len()).find(|&j| t[j] == LITERAL).unwrap_or(t.len());
            push(out, shown(&t[i + 1..end]), upright(style));
            return (end + 1).min(t.len());
        }
        if c == '{' {
            if let Some((_, end)) = name_group(t, i) {
                out.extend(self.sequence(&t[i + 1..end], style, roman));
                return end + 1;
            }
            self.problems.push((codes::MARKUP_UNBALANCED_BRACES, "unbalanced braces are shown as written".into()));
            push(out, shown(&t[i..]), upright(style));
            return t.len();
        }
        if c == '_' || c == '^' {
            let mut script = style;
            script.level = if c == '_' { script.level.saturating_sub(1) } else { script.level.saturating_add(1) };
            let next = (i + 1..t.len()).find(|&j| !t[j].is_whitespace());
            if next.is_none_or(|next| matches!(t[next], '_' | '^' | '}')) {
                self.unknown(out, &t[i..i + 1], style);
                return i + 1;
            }
            let next = next.unwrap();
            if t[next] == '{' && name_group(t, next).is_none() {
                self.problems.push((codes::MARKUP_UNBALANCED_BRACES, "unbalanced braces are shown as written".into()));
                push(out, shown(&t[i..]), upright(style));
                return t.len();
            }
            // Scripts can nest without braces; count these recursive atoms as well.
            if self.depth == 64 {
                out.extend(self.too_deep(&t[i..], style));
                return t.len();
            }
            self.depth += 1;
            let end = self.atom(t, i + 1, script, roman, out);
            self.depth -= 1;
            return end;
        }
        if c == '\\' {
            let mut end = i + 1;
            while t.get(end).is_some_and(char::is_ascii_alphabetic) {
                end += 1;
            }
            let command: String = t[i + 1..end].iter().collect();
            if matches!(command.as_str(), "frac" | "sqrt" | "mathrm") {
                let first = name_group(t, end);
                let second = first.and_then(|(_, e)| name_group(t, e + 1));
                if let Some((start, finish)) = first.filter(|_| command != "frac" || second.is_some()) {
                    let inner = self.sequence(&t[start + 1..finish], style, roman || command == "mathrm");
                    if command == "frac" {
                        let (start2, end2) = second.unwrap();
                        let den = self.sequence(&t[start2 + 1..end2], style, roman);
                        out.push(Run::Frac { num: inner, den, style });
                        return end2 + 1;
                    }
                    if command == "sqrt" {
                        out.push(Run::Sqrt { radicand: inner, style });
                    } else {
                        out.extend(inner);
                    }
                    return finish + 1;
                }
            } else if let Some(ch) = symbol(&command).filter(|_| command != "textbackslash") {
                let mut st = upright(style);
                // Greek letters, like Latin letters, are variables; relation symbols are upright.
                if ch.is_alphabetic() && !roman {
                    st.italic = true;
                    st.upright = false;
                }
                push(out, ch.to_string(), st);
                return super::after_command(t, end);
            }
            // An unsupported command and its braced arguments remain literal, including braces.
            if end == i + 1 {
                end = (end + 1).min(t.len());
            }
            while let Some((_, finish)) = name_group(t, end) {
                end = finish + 1;
            }
            self.unknown(out, &t[i..end], style);
            return end;
        }
        if c == '}' {
            self.problems.push((codes::MARKUP_UNBALANCED_BRACES, "unbalanced braces are shown as written".into()));
        }
        let mut st = upright(style);
        if c.is_alphabetic() && !roman {
            st.italic = true;
            st.upright = false;
        }
        push(out, c.to_string(), st);
        i + 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::markup::{expand, parse_with_name_formats, plain, problems_with_name_formats};

    #[test]
    fn variables_digits_and_roman_scripts_have_their_own_faces() {
        let lines = parse_with_name_formats(r"before \(g_m = 2V_\mathrm{DD}+\alpha\leq 3\) after", true);
        assert_eq!(plain(&lines[0]), "before gm=2VDD+α≤3 after");
        let find = |want: &str| {
            lines[0]
                .iter()
                .find_map(|r| match r {
                    Run::Text { text, style } if text == want => Some(*style),
                    _ => None,
                })
                .unwrap()
        };
        assert!(find("g").italic);
        assert_eq!(find("m").level, -1);
        assert!(find("DD").upright);
        assert_eq!(find("DD").level, -1);
        assert!(find("=2").upright);
        assert!(find("α").italic);
        assert!(find("≤3").upright);
        assert!(problems_with_name_formats(r"\(V_\mathrm{DD}\)", true).is_empty());
    }

    #[test]
    fn fractions_roots_and_attributes_are_nested_without_reparsing_values() {
        let input = expand(r"\(\frac{\sqrt{x^2+${value}}}{y_1}\)", |_| r"A B_1\)".into());
        let lines = parse_with_name_formats(&input, true);
        let Run::Frac { num, den, .. } = &lines[0][0] else { panic!("{:?}", lines[0]) };
        let Run::Sqrt { radicand, .. } = &num[0] else { panic!("{num:?}") };
        assert_eq!(plain(radicand), r"x2+A B_1\)");
        assert!(radicand
            .iter()
            .any(|r| matches!(r, Run::Text { text, style } if text.ends_with(r"A B_1\)") && style.upright)));
        assert_eq!(plain(den), "y1");
    }

    #[test]
    fn a_written_literal_reference_keeps_braces_and_math_delimiters() {
        let input = crate::markup::expand_math(r"\(x+\${a_1\)}\)", |_| panic!("literal reference was evaluated"));
        let lines = parse_with_name_formats(&input, true);
        assert_eq!(plain(&lines[0]), r"x+${a_1\)}");
        assert!(lines[0]
            .iter()
            .any(|r| matches!(r, Run::Text { text, style } if text.contains("${") && style.upright)));
    }

    #[test]
    fn deep_math_is_bounded_and_keeps_visible_content() {
        for (depth, limited) in [(32, false), (70, true)] {
            let source = format!("\\({}x{}\\)", "\\sqrt{".repeat(depth), "}".repeat(depth));
            let errors = problems_with_name_formats(&source, true);
            assert_eq!(errors.iter().any(|(code, _)| *code == codes::MARKUP_MATH_DEPTH), limited);
            assert!(plain(&parse_with_name_formats(&source, true)[0]).contains('x'));
        }
    }

    #[test]
    fn unsupported_or_unclosed_math_stays_visible_and_warns() {
        for (input, expected) in [
            (r"\(\textbf{x}\)", r"\textbf{x}"),
            (r"\(\frac{x}\)", r"\frac{x}"),
            (r"\(\sqrt x\)", r"\sqrtx"),
            (r"\(x+1", r"\(x+1"),
            (r"\(x^{2\)", "x^{2"),
        ] {
            assert_eq!(plain(&parse_with_name_formats(input, true)[0]), expected, "{input}");
            assert!(!problems_with_name_formats(input, true).is_empty(), "{input}");
        }
        let input = r"\(g_m+\sqrt{x}\)";
        assert_eq!(plain(&parse_with_name_formats(input, false)[0]), input);
        assert!(!problems_with_name_formats(input, false).is_empty());
    }
}
