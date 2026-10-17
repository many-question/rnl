
use super::*;
use crate::resolve::tests::{instance, problem_of};

#[test]
fn a_relation_between_two_points_is_one_bound_and_between_sets_a_separator() {
    let p = problem_of(vec![instance(), instance(), instance()], Vec::new());
    let mut model = Model::new(&p, Q::zero());
    let o = PointId::Origin;
    let one = (Q::one(), Q::one());
    let rel =
        Relation::Apart { axis: 1, low: vec![(o(0), one.0.clone())], high: vec![(o(1), -one.1.clone())], gap: int(2) };
    let u = rel.unit(&mut model, 0);
    assert_eq!(u.fixed.len(), 1);
    // y1 − 1 ≥ y0 + 1 + 2
    assert_eq!(u.fixed[0].lo, Some(int(4)));
    assert_eq!(u.touched[1], vec![o(0), o(1)]);
    let vars = model.vars.len();
    let rel = Relation::Apart {
        axis: 0,
        low: vec![(o(0), int(1)), (o(1), int(1))],
        high: vec![(o(2), int(-3))],
        gap: int(2),
    };
    let u = rel.unit(&mut model, 1);
    assert_eq!(model.vars.len(), vars + 1);
    assert_eq!(u.fixed.len(), 3);
    let rel = Relation::OneOf(vec![
        vec![(0, vec![(o(1), int(1)), (o(0), int(-1))], int(3))],
        vec![(1, vec![(o(0), int(1))], int(0))],
    ]);
    let u = rel.unit(&mut model, 2);
    assert_eq!(u.choices.len(), 1);
    assert_eq!(u.choices[0].values.len(), 2);
    assert_eq!(u.choices[0].kind, ChoiceKind::Ranked);
    assert_eq!(u.touched, [vec![o(0), o(1)], vec![o(0)]]);
}

/// An ORDER given only an axis fixes no precedence; reversed, its members swap their order,
/// the others staying where they were.
#[test]
fn a_fact_whose_side_is_open_is_reversed() {
    use rnl_runtime::problem::{Axis, FactKind, PointRef, Sense};
    let o = PointRef::Origin;
    let order = FactKind::Order { axis: Axis::X, sense: Sense::Either, members: vec![o(0), o(2)] };
    let p = problem_of(vec![instance(), instance(), instance()], vec![crate::resolve::tests::fact(order)]);
    let options = SolverOptions::without_time_limit();
    let mut work = Work::default();
    let resolved = crate::resolve(&p, &options);
    let s = crate::structure::analyse(&p, &resolved, &options, crate::options::CAPS, &mut work);
    assert!(s.precedence.is_empty());
    assert_eq!(s.reversible.len(), 1);
    let (a, b) = s.reversible[0].pairs[0];
    let mut search = Search { problem: &p, s: &s, options: &options, made: 0, work: &mut work };
    let border = vec![Item::Element(0), Item::Element(1), Item::Element(2)];
    let mut plan = p0_plan(&s);
    plan.items.insert(0, border.clone());
    let reversed = search.reversed(0, &plan, &border);
    assert_eq!(reversed.len(), 1);
    let q = &reversed[0].2;
    assert_eq!(q.flipped, BTreeSet::from([0]));
    let at = |k: usize| q.order.iter().position(|&j| j == k).unwrap();
    // the witness had a before b: now b goes first
    assert!(at(b) < at(a), "{:?}", q.order);
    // and reversed again, back as the witness had it
    let again = search.reversed(0, q, &q.items[&0].clone());
    assert!(again[0].2.flipped.is_empty());
    let at = |k: usize| again[0].2.order.iter().position(|&j| j == k).unwrap();
    assert!(at(a) < at(b), "{:?}", again[0].2.order);
}

#[test]
fn constants_go_up_to_the_grid() {
    let g = Some(int(1));
    assert_eq!(up(crate::rational::frac(16, 5), &g), int(4));
    assert_eq!(up(int(3), &g), int(3));
    assert_eq!(up(crate::rational::frac(-1, 2), &g), int(0));
    assert_eq!(up(crate::rational::frac(16, 5), &None), crate::rational::frac(16, 5));
    assert_eq!(up(crate::rational::frac(3, 4), &Some(crate::rational::frac(1, 2))), int(1));
}
