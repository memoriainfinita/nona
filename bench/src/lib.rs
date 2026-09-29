use sudoku_core::{Difficulty, Generator, Grid, Solver};
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
