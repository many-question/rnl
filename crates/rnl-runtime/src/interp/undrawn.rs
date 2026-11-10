//! Drawing statements about instances the renderer leaves undrawn (9.2.8).
use std::collections::{HashMap, HashSet};

use super::ctx::Ctx;
use super::obj::*;
use super::scene::{Fact, FactData};
use super::Interp;

impl Interp<'_> {
    /// A key text can contain layers from several source versions. Remove only the
    /// ineffective layers; an older language's text and position keep their behavior.
    pub(super) fn ignore_undrawn_text_layers(&mut self, scene: SceneId) {
        let sources = self.scenes[scene].pin_text_sources.clone();
        let mut rejected: HashMap<ObjId, Vec<Pos>> = HashMap::new();
        let mut kept = HashMap::new();
        let mut kept_direct = HashMap::new();
        for source in &sources {
            let ObjData::KeyText { attach, .. } = self.o(source.text) else { continue };
            if self.ignores_drawing_inputs(scene, Some(&source.ctx), &[*attach]) {
                rejected.entry(source.text).or_default().push(source.order.clone());
            } else {
                kept.insert(source.text, source);
                if !source.generated {
                    kept_direct.insert(source.text, source);
                }
            }
        }
        for (text, orders) in rejected {
            if let ObjData::KeyText { layers, site, off, direct, generated, .. } = self.om(text) {
                layers.retain(|(order, _, _)| !orders.contains(order));
                // With no remaining layer, keep its source so it is recognized as ignored,
                // and its handle remains usable. In particular, do not mark it failed.
                if let Some(last) = kept.get(&text) {
                    *site = Some(last.ctx.clone());
                    *off = last.off;
                    *generated = last.generated;
                    *direct = kept_direct.get(&text).map(|source| (source.ctx.clone(), source.off));
                }
            }
        }
    }

    // Take back only the new no-effect rewrites before geometry follows drawing positions.
    // Other rewrite failures retain their released geometry-phase order.
    pub(super) fn ignore_undrawn_rewrites(&mut self, scene: SceneId) {
        let mut wires: Vec<_> = self.scenes[scene].rewrites.keys().copied().collect();
        wires.sort();
        for wire in wires {
            for index in 0..self.scenes[scene].rewrites[&wire].len() {
                let rewrite = &self.scenes[scene].rewrites[&wire][index];
                if !self.ignores_drawing_inputs(scene, Some(&rewrite.site), &rewrite.points) {
                    continue;
                }
                let rewrite = &mut self.scenes[scene].rewrites.get_mut(&wire).unwrap()[index];
                rewrite.ignored = true;
                if let Some(style) = rewrite.style.and_then(|i| self.scenes[scene].styles.get_mut(i)) {
                    style.data = FactData::OwnStyle(StyleMap::new());
                }
            }
        }
    }

    /// Follow drawing positions, never semantic usage roles: a usage has its own point.
    fn undrawn_input(&self, scene: SceneId, object: ObjId) -> bool {
        let mut todo = vec![object];
        let mut seen = HashSet::new();
        while let Some(object) = todo.pop() {
            let object = self.scene_value(object);
            if !seen.insert(object) {
                continue;
            }
            match self.o(object) {
                ObjData::Inst { .. } | ObjData::Bundle { .. } => {
                    if self.scenes[scene].undrawn.iter().any(|(candidate, _)| *candidate == object) {
                        return true;
                    }
                }
                ObjData::Term { owner, .. } | ObjData::ScenePin { owner, .. } => todo.push(*owner),
                ObjData::Pos { parent } => todo.push(*parent),
                ObjData::Text { attach, .. } | ObjData::KeyText { attach, .. } => todo.push(*attach),
                ObjData::Prim { points, .. } => todo.extend(points),
                ObjData::Wire { .. } => {
                    if let Some(shape) = self.wire_shape(scene, object) {
                        todo.extend(shape.points);
                    }
                }
                _ => {}
            }
        }
        false
    }

    pub(super) fn ignores_drawing_inputs(&self, scene: SceneId, site: Option<&Ctx>, inputs: &[ObjId]) -> bool {
        !self.scenes[scene].undrawn.is_empty()
            && site.is_some_and(|ctx| self.follows_0_4(self.source_unit(ctx)))
            && inputs.iter().any(|&input| self.undrawn_input(scene, input))
    }

    pub(super) fn ignores_drawing_fact(&self, scene: SceneId, fact: &Fact) -> bool {
        match fact.data {
            FactData::Coord(..) | FactData::Orient(..) => {
                self.ignores_drawing_inputs(scene, fact.ctx.as_deref(), &[fact.target])
            }
            FactData::RelativeCoord(_, _, base) => {
                self.ignores_drawing_inputs(scene, fact.ctx.as_deref(), &[fact.target, base])
            }
            _ => false,
        }
    }

    /// Omit the complete drawing, retaining its handle and the creation-phase snapshot.
    pub(super) fn drawing_ignored(&self, scene: SceneId, object: ObjId) -> bool {
        match self.o(object) {
            ObjData::Wire { .. } => self
                .wire_shape(scene, object)
                .is_some_and(|shape| self.ignores_drawing_inputs(scene, shape.site.as_deref(), &shape.points)),
            ObjData::Text { attach, site, .. } => self.ignores_drawing_inputs(scene, site.as_deref(), &[*attach]),
            ObjData::KeyText { attach, site, direct, .. } => self.ignores_drawing_inputs(
                scene,
                direct.as_ref().map(|(ctx, _)| ctx.as_ref()).or(site.as_deref()),
                &[*attach],
            ),
            ObjData::Prim { points, site, .. } => self.ignores_drawing_inputs(scene, site.as_deref(), points),
            _ => false,
        }
    }
}
