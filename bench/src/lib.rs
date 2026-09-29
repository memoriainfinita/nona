use sudoku_core::{BitSet, Difficulty, Generator, Grid, Position, Solver};
use wasm_bindgen::prelude::*;

fn parse_level(level: &str) -> Result<Difficulty, JsError> {
    Ok(match level {
        "beginner" => Difficulty::Beginner,
        "easy" => Difficulty::Easy,
        "medium" => Difficulty::Medium,
        "intermediate" => Difficulty::Intermediate,
        "hard" => Difficulty::Hard,
        "expert" => Difficulty::Expert,
        "master" => Difficulty::Master,
        "extreme" => Difficulty::Extreme,
        _ => return Err(JsError::new("unknown level")),
    })
}

fn parse_grid(puzzle: &str) -> Result<Grid, JsError> {
    Grid::from_string(puzzle).ok_or_else(|| JsError::new("invalid puzzle"))
}

/// Returns the puzzle as an 81-char string.
#[wasm_bindgen]
pub fn generate(level: &str) -> Result<String, JsError> {
    let difficulty = parse_level(level)?;
    Ok(Generator::new().generate(difficulty).to_string_compact())
}

/// Same as `generate`, deterministic for a given seed. For native vs WASM comparison.
#[wasm_bindgen]
pub fn generate_seeded(level: &str, seed: u64) -> Result<String, JsError> {
    let difficulty = parse_level(level)?;
    Ok(Generator::with_seed(seed).generate(difficulty).to_string_compact())
}

/// Returns JSON: {"level": "...", "se": n}.
#[wasm_bindgen]
pub fn analyze(puzzle: &str) -> Result<String, JsError> {
    let (difficulty, se) = Solver::new().analyze(&parse_grid(puzzle)?);
    Ok(serde_json::json!({ "level": difficulty.to_string(), "se": se }).to_string())
}

/// Returns the hint as JSON, or "null" when none is found.
#[wasm_bindgen]
pub fn hint(puzzle: &str) -> Result<String, JsError> {
    let hint = Solver::new().get_hint(&parse_grid(puzzle)?);
    serde_json::to_string(&hint).map_err(|e| JsError::new(&e.to_string()))
}

/// Hint from the caller's candidates, without recalculating them (fork `f56364e`).
/// `masks[i]` holds cell i's candidates, bit v set for digit v; ignored for filled cells.
/// Returns the hint as JSON, or "null" when none is found.
#[wasm_bindgen]
pub fn hint_with_candidates(puzzle: &str, masks: &[u16]) -> Result<String, JsError> {
    if masks.len() != 81 {
        return Err(JsError::new("expected 81 masks"));
    }
    let mut grid = parse_grid(puzzle)?;
    for (i, &mask) in masks.iter().enumerate() {
        let pos = Position { row: i / 9, col: i % 9 };
        if grid.get(pos).is_none() {
            let digits: Vec<u8> = (1..=9).filter(|&v| mask & (1 << v) != 0).collect();
            grid.cell_mut(pos).set_candidates(BitSet::from_slice(&digits));
        }
    }
    let hint = Solver::new().get_hint_with_candidates(&grid);
    serde_json::to_string(&hint).map_err(|e| JsError::new(&e.to_string()))
}
