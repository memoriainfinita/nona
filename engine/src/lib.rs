use serde::Serialize;
use sudoku_core::{BitSet, Grid, HintType, Position, Solver, Technique};
use wasm_bindgen::prelude::*;

/// A hint in the shape the app uses. Cells are indices 0..81, row-major.
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppHint {
    /// Readable technique name (`Display` of `Technique`).
    pub technique: String,
    /// True when no logical technique applies and the engine fell back to backtracking.
    pub backtracking: bool,
    /// "place" or "eliminate".
    pub kind: &'static str,
    pub cell: usize,
    /// Placed value for "place", removed candidates for "eliminate".
    pub values: Vec<u8>,
    pub cells: Vec<usize>,
    pub explanation: String,
}

fn index(pos: Position) -> usize {
    pos.row * 9 + pos.col
}

fn parse_grid(puzzle: &str) -> Result<Grid, String> {
    Grid::from_string(puzzle).ok_or_else(|| "invalid puzzle".to_string())
}

/// Hint on the caller's candidates, without recalculating them.
/// `masks[i]` holds cell i's candidates, bit v set for digit v; ignored for filled cells.
pub fn hint_on(puzzle: &str, masks: &[u16]) -> Result<Option<AppHint>, String> {
    if masks.len() != 81 {
        return Err("expected 81 masks".to_string());
    }
    let mut grid = parse_grid(puzzle)?;
    for (i, &mask) in masks.iter().enumerate() {
        let pos = Position { row: i / 9, col: i % 9 };
        if grid.get(pos).is_none() {
            let digits: Vec<u8> = (1..=9).filter(|&v| mask & (1 << v) != 0).collect();
            grid.cell_mut(pos).set_candidates(BitSet::from_slice(&digits));
        }
    }
    let Some(hint) = Solver::new().get_hint_with_candidates(&grid) else {
        return Ok(None);
    };
    let (kind, cell, values) = match hint.hint_type {
        HintType::SetValue { pos, value } => ("place", index(pos), vec![value]),
        HintType::EliminateCandidates { pos, values } => ("eliminate", index(pos), values),
    };
    Ok(Some(AppHint {
        technique: hint.technique.to_string(),
        backtracking: hint.technique == Technique::Backtracking,
        kind,
        cell,
        values,
        cells: hint.involved_cells.into_iter().map(index).collect(),
        explanation: hint.explanation,
    }))
}

/// Returns the hint as JSON, or "null" when none is found (solved or unsolvable grid).
#[wasm_bindgen]
pub fn hint(puzzle: &str, masks: &[u16]) -> Result<String, JsError> {
    let hint = hint_on(puzzle, masks).map_err(|e| JsError::new(&e))?;
    serde_json::to_string(&hint).map_err(|e| JsError::new(&e.to_string()))
}

/// Returns JSON: {"level": "...", "se": n}. `se` is the engine's own scale, not Sudoku Explainer's.
#[wasm_bindgen]
pub fn analyze(puzzle: &str) -> Result<String, JsError> {
    let (difficulty, se) = Solver::new().analyze(&parse_grid(puzzle).map_err(|e| JsError::new(&e))?);
    Ok(serde_json::json!({ "level": difficulty.to_string(), "se": se }).to_string())
}
