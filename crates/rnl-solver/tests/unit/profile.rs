//! Opt-in, test-only timing. Nested sections overlap and must not be added together.
use std::cell::RefCell;
use std::collections::BTreeMap;
use std::time::Instant;

thread_local! {
    static TIMINGS: RefCell<Option<BTreeMap<String, (u64, f64)>>> = const { RefCell::new(None) };
    static ORIENTATIONS: RefCell<Vec<serde_json::Value>> = const { RefCell::new(Vec::new()) };
}

pub(crate) fn oracle_enabled() -> bool {
    std::env::var_os("RNL_PROFILE_ORACLE").is_some()
}
pub(crate) fn orientations(
    members: &[(usize, rnl_runtime::geom::Orient)],
    values: &[rnl_runtime::geom::Orient],
    scores: &[Vec<crate::rational::Q>],
    rank: &[usize],
) {
    if TIMINGS.with(|t| t.borrow().is_none()) {
        return;
    }
    ORIENTATIONS.with(|events|events.borrow_mut().push(serde_json::json!({"members":members.iter().map(|(k,o)|serde_json::json!({"object":k,"label":format!("{o:?}")})).collect::<Vec<_>>(),"values":values.iter().map(|o|format!("{o:?}")).collect::<Vec<_>>(),"scores":scores.iter().map(|xs|xs.iter().map(crate::rational::exact_text).collect::<Vec<_>>()).collect::<Vec<_>>(),"rank":rank,"retained":rank.iter().take(2).copied().collect::<Vec<_>>()})));
}

pub(crate) struct Section<'a> {
    name: &'a str,
    start: Option<Instant>,
}

pub(crate) fn section(name: &str) -> Section<'_> {
    let enabled = TIMINGS.with(|t| t.borrow().is_some());
    Section { name, start: enabled.then(Instant::now) }
}

impl Drop for Section<'_> {
    fn drop(&mut self) {
        if let Some(start) = self.start {
            let seconds = start.elapsed().as_secs_f64();
            TIMINGS.with(|t| {
                if let Some(values) = t.borrow_mut().as_mut() {
                    let entry = values.entry(self.name.to_string()).or_default();
                    entry.0 += 1;
                    entry.1 += seconds;
                }
            });
        }
    }
}

fn reset() {
    TIMINGS.with(|t| *t.borrow_mut() = Some(BTreeMap::new()));
    ORIENTATIONS.with(|t| t.borrow_mut().clear());
}

fn take() -> serde_json::Value {
    let values = TIMINGS.with(|t| t.borrow_mut().take().unwrap());
    serde_json::json!(values
        .into_iter()
        .map(|(name, (calls, seconds))| (name, serde_json::json!({"calls":calls,"seconds":seconds})))
        .collect::<BTreeMap<_, _>>())
}

#[test]
#[ignore = "requires explicit input/config/output paths for isolated profiling"]
fn isolated_stage_profile() {
    use crate::score::{drawn, layers, order, Entry};
    struct Files;
    impl rnl_runtime::source::Provider for Files {
        fn read(&self, path: &str) -> Option<String> {
            std::fs::read_to_string(path).ok()
        }
    }
    let input = std::env::var("RNL_PROFILE_INPUT").unwrap();
    let output = std::env::var("RNL_PROFILE_OUTPUT").unwrap();
    let config = std::env::var("RNL_PROFILE_CONFIG").unwrap();
    let mut options = crate::SolverOptions::from_toml(&std::fs::read_to_string(config).unwrap()).unwrap();
    options.time_limit = None;
    let document = rnl_view::interpret(&input, None, &Files, &rnl_runtime::Options::solver()).unwrap();
    assert!(!document.diagnostics().iter().any(|d| d.severity == rnl_runtime::diag::Severity::Error));
    let mut reports = Vec::new();
    for problem in document.problems.iter().filter(|p| !p.objects.is_empty()) {
        let total = Instant::now();
        let mut stages = BTreeMap::new();
        let start = Instant::now();
        let resolved = crate::resolve(problem, &options);
        stages.insert("resolve", start.elapsed().as_secs_f64());
        let mut work = resolved.work;
        let start = Instant::now();
        let structure = crate::structure::analyse(problem, &resolved, &options, crate::options::CAPS, &mut work);
        stages.insert("analyse", start.elapsed().as_secs_f64());
        reset();
        let start = Instant::now();
        let candidates = crate::search::search(problem, &structure, &options, &mut work);
        stages.insert("search", start.elapsed().as_secs_f64());
        let search_sections = take();
        let orientation_trace = ORIENTATIONS.with(|t| t.borrow_mut().drain(..).collect::<Vec<_>>());
        println!(
            "stage-profile {} search_seconds={:.6} candidates={}",
            problem.title,
            stages["search"],
            candidates.len()
        );
        let mut placing = Vec::new();
        let mut coords_seconds = 0.0;
        let mut estimate_seconds = 0.0;
        for candidate in candidates {
            let start = Instant::now();
            let placed = crate::coords::place(problem, &structure, &candidate, &options, &mut work);
            coords_seconds += start.elapsed().as_secs_f64();
            let start = Instant::now();
            let entry = Entry {
                layers: layers(&structure, &placed.origins, &placed.geometry, None),
                code: candidate.code(&structure),
            };
            estimate_seconds += start.elapsed().as_secs_f64();
            placing.push((candidate, placed, entry));
        }
        stages.insert("coords", coords_seconds);
        stages.insert("placed_estimates", estimate_seconds);
        let estimates: Vec<_> = placing.iter().map(|(_, _, e)| e.clone()).collect();
        let ranked = order(&structure.active, &estimates);
        let mut finals = Vec::new();
        let mut route_seconds = 0.0;
        let mut score_seconds = 0.0;
        for &i in ranked.iter().take(options.route_beam.max(1)) {
            let (candidate, placed, _) = &placing[i];
            let start = Instant::now();
            let routing =
                crate::route::route(problem, &structure, &placed.geometry, &placed.origins, &options, &mut work);
            let seconds = start.elapsed().as_secs_f64();
            route_seconds += seconds;
            let start = Instant::now();
            let wires = drawn(problem, &structure, &placed.geometry, &routing);
            let entry = Entry {
                layers: layers(&structure, &placed.origins, &placed.geometry, Some(&wires)),
                code: candidate.code(&structure),
            };
            score_seconds += start.elapsed().as_secs_f64();
            println!(
                "stage-profile routed candidate={i} origin={} route_seconds={seconds:.6} expansions={}",
                candidate.origin, routing.expansions
            );
            finals.push((i, routing, entry));
        }
        stages.insert("route", route_seconds);
        stages.insert("final_score", score_seconds);
        let entries: Vec<_> = finals.iter().map(|(_, _, e)| e.clone()).collect();
        let best = order(&structure.active, &entries)[0];
        let exact_layers = |xs: &[crate::rational::Q]| xs.iter().map(crate::rational::exact_text).collect::<Vec<_>>();
        let estimated = ranked.iter().map(|&i| serde_json::json!({"candidate":i,"origin":placing[i].0.origin,"code":placing[i].2.code,"layers":exact_layers(&placing[i].2.layers)})).collect::<Vec<_>>();
        let routed = finals.iter().map(|(i,r,e)| serde_json::json!({"candidate":i,"origin":placing[*i].0.origin,"layers":exact_layers(&e.layers),"expansions":r.expansions,"fallbacks":r.fallbacks.iter().map(|f|serde_json::json!({"route":f.route,"net":f.net,"phase":f.phase,"reason":f.reason})).collect::<Vec<_>>()})).collect::<Vec<_>>();
        let old = std::env::var("RNL_QUALITY_OLD").ok().map(|old|{
            use rnl_runtime::problem::{Axis,FactKind,PointRef};
            let with=rnl_view::interpret(&old,None,&Files,&rnl_runtime::Options{problems:true,..Default::default()}).unwrap();
            let previous=rnl_runtime::previous::previous(problem,&with).expect("old record maps to current problem");
            let mut pinned=problem.clone();
            let original=pinned.facts.len();
            for p in &previous.placements {
                for (axis,value) in [(Axis::X,p.x),(Axis::Y,p.y)]{if let Some(value)=value{pinned.facts.push(crate::resolve::tests::fact(FactKind::Place{at:PointRef::Origin(p.object),axis,value}));}}
                if let Some(code)=p.orient{pinned.facts.push(crate::resolve::tests::fact(FactKind::Orient{object:p.object,code}));}
            }
            let checked=crate::resolve(&pinned,&options);
            assert_eq!(checked.kept.iter().copied().filter(|&f|f<original).collect::<Vec<_>>(),resolved.kept,"old record changed authored fact retention");
            assert!((original..pinned.facts.len()).all(|f|checked.kept.contains(&f)),"old record contradicts retained facts");
            serde_json::json!({"input":old,"original_kept":resolved.kept,"added_frame_facts":pinned.facts.len()-original,"all_frame_facts_kept":true,"orientations":previous.placements.iter().filter_map(|p|Some(serde_json::json!({"object":p.object,"label":problem.objects[p.object].label,"orientation":format!("{:?}",p.orient?)}))).collect::<Vec<_>>()})
        });
        reports.push(serde_json::json!({"title":problem.title,"input":input,"total_seconds":total.elapsed().as_secs_f64(),"stage_seconds":stages,"search_sections_nested":search_sections,"orientation_trace":orientation_trace,"old_record":old,"estimated_rank":estimated,"routed":routed,"chosen_candidate":finals[best].0,"work":{"resolve_nodes":work.resolve_nodes,"pivots":work.pivots,"candidates":work.candidates,"astar_expansions":work.astar_expansions}}));
    }
    std::fs::write(output, serde_json::to_vec_pretty(&reports).unwrap()).unwrap();
}
