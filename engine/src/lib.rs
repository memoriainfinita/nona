use serde::Serialize;
use sudoku_core::{BitSet, Grid, Hint, HintType, Polarity, Position, ProofCertificate, Solver, Technique};
use wasm_bindgen::prelude::*;

// Cells are indices 0..81, row-major. Units (sectors) are 0..27: rows 0..9, columns 9..18,
// boxes 18..27, the order the engine uses.

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Placement {
    pub cell: usize,
    pub value: u8,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Elimination {
    pub cell: usize,
    pub values: Vec<u8>,
}

#[derive(Serialize, Debug, Clone)]
pub struct AlsSet {
    pub cells: Vec<usize>,
    pub digits: Vec<u8>,
    pub unit: usize,
}

#[derive(Serialize, Debug, Clone)]
pub struct ChainNode {
    pub cell: usize,
    pub digit: u8,
    /// The node's candidate is true (on) or false (off) along the chain.
    pub on: bool,
}

/// Data for the app's explanation, one variant per family of techniques.
#[derive(Serialize, Debug, Clone)]
#[serde(tag = "family", rename_all = "camelCase")]
pub enum Detail {
    /// `unit` is where a hidden single is the only place; none for a naked single.
    Single { naked: bool, cell: usize, value: u8, unit: Option<usize> },
    /// The set's cells and digits, and every unit that holds all its cells.
    Subset { naked: bool, cells: Vec<usize>, digits: Vec<u8>, units: Vec<usize> },
    /// In `from`, the digit lies only where `from` meets `to`.
    Intersection { pointing: bool, digit: u8, from: usize, to: usize },
    Fish { digit: u8, bases: Vec<usize>, covers: Vec<usize>, fins: Vec<usize> },
    /// In the box, the digit lies only on `lines` (a row and a column); `link` is the strong
    /// link outside the box.
    EmptyRectangle {
        digit: u8,
        #[serde(rename = "box")]
        box_unit: usize,
        lines: Vec<usize>,
        link: Vec<usize>,
    },
    /// Almost locked sets linked by restricted common digits; `z` is the eliminated digit.
    Als { sets: Vec<AlsSet>, links: Vec<u8>, z: Option<u8> },
    /// Alternating chain, nodes in order: the first or the last node is true.
    Chain { nodes: Vec<ChainNode> },
    /// 3D Medusa: candidates coloured in two sets; the nodes come unordered.
    Coloring { nodes: Vec<ChainNode> },
    /// Uniqueness: four corners on two digits.
    Rectangle { corners: Vec<usize>, digits: Vec<u8> },
    Other,
    Backtracking,
}

/// A hint in the shape the app uses.
#[derive(Serialize, Debug, Clone)]
pub struct AppHint {
    /// Readable technique name (`Display` of `Technique`, "Pointing Triple" with three cells).
    pub technique: String,
    /// True when no logical technique applies and the engine fell back to backtracking.
    pub backtracking: bool,
    /// The placement; none for an elimination hint.
    pub place: Option<Placement>,
    /// Every elimination of the pattern, one entry per cell. Empty for a placement.
    pub eliminations: Vec<Elimination>,
    /// Cells that form the pattern, without repeats.
    pub pattern: Vec<usize>,
    /// Unit to shade: hidden singles and intersections.
    pub unit: Option<usize>,
    /// Key candidates to highlight, as [cell, digit].
    pub marks: Vec<(usize, u8)>,
    pub detail: Detail,
}

// ==================== Units ====================

fn unit_cells(u: usize) -> [usize; 9] {
    let mut out = [0; 9];
    for (k, cell) in out.iter_mut().enumerate() {
        *cell = match u {
            0..=8 => u * 9 + k,
            9..=17 => k * 9 + (u - 9),
            _ => {
                let b = u - 18;
                (b / 3 * 3 + k / 3) * 9 + b % 3 * 3 + k % 3
            }
        };
    }
    out
}

fn units_of(cell: usize) -> [usize; 3] {
    let (r, c) = (cell / 9, cell % 9);
    [r, 9 + c, 18 + r / 3 * 3 + c / 3]
}

fn in_unit(cell: usize, u: usize) -> bool {
    units_of(cell).contains(&u)
}

fn sees(a: usize, b: usize) -> bool {
    a != b && units_of(a).iter().any(|&u| in_unit(b, u))
}

fn bit(v: u8) -> u16 {
    1 << v
}

fn digits_of(mask: u16) -> Vec<u8> {
    (1..=9).filter(|&v| mask & bit(v) != 0).collect()
}

fn dedup(cells: impl IntoIterator<Item = usize>) -> Vec<usize> {
    let mut out = Vec::new();
    for c in cells {
        if !out.contains(&c) {
            out.push(c);
        }
    }
    out
}

fn index(pos: Position) -> usize {
    pos.row * 9 + pos.col
}

// ==================== Board state ====================

#[derive(Clone)]
struct State {
    values: [u8; 81],
    /// Candidates of empty cells (bit v = digit v); 0 for filled cells.
    masks: [u16; 81],
}

impl State {
    fn parse(puzzle: &str, masks: &[u16]) -> Result<State, String> {
        if masks.len() != 81 {
            return Err("expected 81 masks".to_string());
        }
        Grid::from_string(puzzle).ok_or_else(|| "invalid puzzle".to_string())?;
        let mut values = [0u8; 81];
        for (i, b) in puzzle.bytes().enumerate() {
            if b.is_ascii_digit() {
                values[i] = b - b'0';
            }
        }
        let mut out = State { values, masks: [0; 81] };
        for i in 0..81 {
            if values[i] == 0 {
                out.masks[i] = masks[i] & 0x3fe;
            }
        }
        Ok(out)
    }

    /// Candidates from the placed values alone.
    fn basic(&self) -> State {
        let mut out = self.clone();
        for i in 0..81 {
            out.masks[i] = 0;
            if self.values[i] == 0 {
                out.masks[i] = 0x3fe;
                for u in units_of(i) {
                    for p in unit_cells(u) {
                        out.masks[i] &= !bit(self.values[p]);
                    }
                }
                out.masks[i] &= 0x3fe;
            }
        }
        out
    }

    fn grid(&self) -> Grid {
        let puzzle: String = self.values.iter().map(|&v| if v == 0 { '.' } else { (b'0' + v) as char }).collect();
        let mut grid = Grid::from_string(&puzzle).expect("valid grid");
        for i in 0..81 {
            if self.values[i] == 0 {
                let pos = Position { row: i / 9, col: i % 9 };
                grid.cell_mut(pos).set_candidates(BitSet::from_slice(&digits_of(self.masks[i])));
            }
        }
        grid
    }

    /// Cells of the unit that can hold the digit.
    fn places(&self, u: usize, digit: u8) -> Vec<usize> {
        unit_cells(u).into_iter().filter(|&c| self.masks[c] & bit(digit) != 0).collect()
    }
}

// ==================== Singles ====================

/// First single in the engine's order: naked singles by cell, then hidden singles by unit and digit.
fn find_single(s: &State) -> Option<(usize, u8, Option<usize>)> {
    for i in 0..81 {
        if s.values[i] == 0 && s.masks[i].count_ones() == 1 {
            return Some((i, s.masks[i].trailing_zeros() as u8, None));
        }
    }
    for u in 0..27 {
        for d in 1..=9 {
            if let [cell] = s.places(u, d)[..] {
                return Some((cell, d, Some(u)));
            }
        }
    }
    None
}

fn single_hint(cell: usize, value: u8, unit: Option<usize>) -> AppHint {
    let naked = unit.is_none();
    AppHint {
        technique: if naked { "Naked Single" } else { "Hidden Single" }.to_string(),
        backtracking: false,
        place: Some(Placement { cell, value }),
        eliminations: vec![],
        pattern: vec![cell],
        unit,
        marks: vec![(cell, value)],
        detail: Detail::Single { naked, cell, value, unit },
    }
}

/// Unit where the digit's only place is the cell, on the given candidates.
fn hidden_unit(s: &State, cell: usize, digit: u8) -> Option<usize> {
    (0..27).find(|&u| in_unit(cell, u) && s.places(u, digit) == [cell])
}

// ==================== Eliminations ====================

fn first_elimination(hint: &Hint) -> Option<Elimination> {
    match &hint.hint_type {
        HintType::EliminateCandidates { pos, values } => Some(Elimination { cell: index(*pos), values: values.clone() }),
        HintType::SetValue { .. } => None,
    }
}

/// Keeps the digits the cell still has; drops empty entries; merges entries for the same cell.
fn clean(s: &State, elims: Vec<Elimination>) -> Vec<Elimination> {
    let mut out: Vec<Elimination> = Vec::new();
    for e in elims {
        let values: Vec<u8> = e.values.into_iter().filter(|&v| s.masks[e.cell] & bit(v) != 0).collect();
        if values.is_empty() {
            continue;
        }
        match out.iter_mut().find(|o| o.cell == e.cell) {
            Some(o) => {
                for v in values {
                    if !o.values.contains(&v) {
                        o.values.push(v);
                    }
                }
                o.values.sort_unstable();
            }
            None => out.push(Elimination { cell: e.cell, values }),
        }
    }
    out
}

fn contains(elims: &[Elimination], e: &Elimination) -> bool {
    elims.iter().any(|o| o.cell == e.cell && e.values.iter().all(|v| o.values.contains(v)))
}

/// Chains: the first or the last node is true. Same digit in two cells: cells that see both
/// lose it. Same cell: it loses every other digit. Two digits in cells that see each other:
/// each cell loses the other end's digit.
fn chain_targets(s: &State, nodes: &[ChainNode]) -> Vec<Elimination> {
    let (Some(a), Some(b)) = (nodes.first(), nodes.last()) else { return vec![] };
    let elims = if a.cell == b.cell {
        vec![Elimination { cell: a.cell, values: digits_of(s.masks[a.cell] & !bit(a.digit) & !bit(b.digit)) }]
    } else if a.digit == b.digit {
        (0..81)
            .filter(|&c| sees(c, a.cell) && sees(c, b.cell))
            .map(|cell| Elimination { cell, values: vec![a.digit] })
            .collect()
    } else if sees(a.cell, b.cell) {
        vec![Elimination { cell: a.cell, values: vec![b.digit] }, Elimination { cell: b.cell, values: vec![a.digit] }]
    } else {
        vec![]
    };
    clean(s, elims)
}

/// ALS with a z digit: cells outside the sets that see every z of every set lose z.
fn als_targets(s: &State, sets: &[AlsSet], z: u8) -> Vec<Elimination> {
    let zs: Vec<usize> = sets.iter().flat_map(|a| a.cells.iter().copied()).filter(|&c| s.masks[c] & bit(z) != 0).collect();
    let elims = (0..81)
        .filter(|c| !sets.iter().any(|a| a.cells.contains(c)))
        .filter(|&c| zs.iter().all(|&p| sees(c, p)))
        .map(|cell| Elimination { cell, values: vec![z] })
        .collect();
    clean(s, elims)
}

/// Fish and intersections: cells of the covers outside the bases that see every fin.
fn fish_targets(s: &State, digit: u8, bases: &[usize], covers: &[usize], fins: &[usize]) -> Vec<Elimination> {
    let cells = dedup(covers.iter().flat_map(|&u| unit_cells(u)));
    let elims = cells
        .into_iter()
        .filter(|&c| !bases.iter().any(|&b| in_unit(c, b)))
        .filter(|&c| fins.iter().all(|&f| sees(c, f)))
        .map(|cell| Elimination { cell, values: vec![digit] })
        .collect();
    clean(s, elims)
}

/// Sue de Coq: the first set is the core (where the box meets the line); each other set's
/// digits leave the rest of its unit; core digits in neither set leave both units.
fn sue_de_coq_targets(s: &State, sets: &[AlsSet]) -> Vec<Elimination> {
    let used: Vec<usize> = sets.iter().flat_map(|a| a.cells.iter().copied()).collect();
    let Some((core, others)) = sets.split_first() else { return vec![] };
    let mask = |d: &[u8]| d.iter().fold(0u16, |m, &v| m | bit(v));
    let in_others = others.iter().fold(0u16, |m, a| m | mask(&a.digits));
    let core_only = mask(&core.digits) & !in_others;
    let mut elims = Vec::new();
    for a in others {
        let digits = mask(&a.digits) | core_only;
        for cell in unit_cells(a.unit).into_iter().filter(|c| !used.contains(c)) {
            elims.push(Elimination { cell, values: digits_of(s.masks[cell] & digits) });
        }
    }
    clean(s, elims)
}

// ==================== Conversion ====================

struct Parts {
    detail: Detail,
    eliminations: Vec<Elimination>,
    pattern: Vec<usize>,
    unit: Option<usize>,
    marks: Vec<(usize, u8)>,
}

fn marks_for(s: &State, cells: &[usize], digits: &[u8]) -> Vec<(usize, u8)> {
    let mut out = Vec::new();
    for &c in cells {
        for &d in digits {
            if s.masks[c] & bit(d) != 0 && !out.contains(&(c, d)) {
                out.push((c, d));
            }
        }
    }
    out
}

fn node(&(cell, digit, polarity): &(usize, u8, Polarity)) -> ChainNode {
    ChainNode { cell, digit, on: polarity == Polarity::On }
}

fn subset(s: &State, hint: &Hint, involved: &[usize], naked: bool) -> Option<Parts> {
    let size = match hint.technique {
        Technique::NakedPair | Technique::HiddenPair => 2,
        Technique::NakedTriple | Technique::HiddenTriple => 3,
        _ => 4,
    };
    let first = first_elimination(hint)?;
    if naked {
        let cells: Vec<usize> = involved.iter().copied().filter(|&c| c != first.cell).collect();
        if cells.len() != size {
            return None;
        }
        let union = cells.iter().fold(0u16, |m, &c| m | s.masks[c]);
        let units: Vec<usize> = (0..27).filter(|&u| cells.iter().all(|&c| in_unit(c, u))).collect();
        let elims = units
            .iter()
            .flat_map(|&u| unit_cells(u))
            .filter(|c| !cells.contains(c))
            .map(|cell| Elimination { cell, values: digits_of(s.masks[cell] & union) })
            .collect();
        let digits = digits_of(union);
        return Some(Parts {
            marks: marks_for(s, &cells, &digits),
            detail: Detail::Subset { naked, cells: cells.clone(), digits, units },
            eliminations: clean(s, elims),
            pattern: cells,
            unit: None,
        });
    }
    let cells = dedup(involved.iter().copied());
    if cells.len() != size {
        return None;
    }
    for u in (0..27).filter(|&u| cells.iter().all(|&c| in_unit(c, u))) {
        let digits: Vec<u8> = (1..=9)
            .filter(|&d| {
                let places = s.places(u, d);
                !places.is_empty() && places.iter().all(|c| cells.contains(c))
            })
            .collect();
        if digits.len() != size {
            continue;
        }
        let keep = digits.iter().fold(0u16, |m, &d| m | bit(d));
        let elims = cells.iter().map(|&cell| Elimination { cell, values: digits_of(s.masks[cell] & !keep) }).collect();
        return Some(Parts {
            marks: marks_for(s, &cells, &digits),
            detail: Detail::Subset { naked, cells: cells.clone(), digits, units: vec![u] },
            eliminations: clean(s, elims),
            pattern: cells,
            unit: None,
        });
    }
    None
}

fn empty_rectangle(s: &State, digit: u8, bases: &[usize], covers: &[usize], involved: &[usize], target: usize) -> Option<Detail> {
    let box_unit = *bases.iter().find(|&&u| u >= 18)?;
    let link: Vec<usize> = involved.iter().copied().filter(|&c| !in_unit(c, box_unit)).collect();
    let in_box = s.places(box_unit, digit);
    let (tr, tc) = (target / 9, 9 + target % 9);
    // One line through the target meets the box; the other is a cover that meets the box.
    let line = [tr, tc].into_iter().find(|&l| unit_cells(box_unit).iter().any(|&c| in_unit(c, l)))?;
    let other = covers
        .iter()
        .copied()
        .find(|&l| l != line && (l < 9) != (line < 9) && unit_cells(box_unit).iter().any(|&c| in_unit(c, l)))?;
    if !in_box.iter().all(|&c| in_unit(c, line) || in_unit(c, other)) {
        return None;
    }
    Some(Detail::EmptyRectangle { digit, box_unit, lines: vec![line, other], link })
}

fn convert(s: &State, hint: &Hint) -> Parts {
    let involved: Vec<usize> = dedup(hint.involved_cells.iter().map(|&p| index(p)));

    if let HintType::SetValue { pos, value } = hint.hint_type {
        let cell = index(pos);
        if hint.technique == Technique::Backtracking {
            return Parts { detail: Detail::Backtracking, eliminations: vec![], pattern: vec![cell], unit: None, marks: vec![] };
        }
        if matches!(hint.technique, Technique::NakedSingle | Technique::HiddenSingle) {
            let unit = if hint.technique == Technique::HiddenSingle { hidden_unit(s, cell, value) } else { None };
            let h = single_hint(cell, value, unit);
            return Parts { detail: h.detail, eliminations: vec![], pattern: h.pattern, unit: h.unit, marks: h.marks };
        }
        let pattern = dedup(involved.into_iter().chain([cell]));
        return Parts { detail: Detail::Other, eliminations: vec![], pattern, unit: None, marks: vec![(cell, value)] };
    }
    let first = first_elimination(hint).expect("elimination");
    // Only what the engine found: families where the pattern does not give the other targets.
    let alone = |detail: Detail, pattern: Vec<usize>, marks: Vec<(usize, u8)>| Parts {
        eliminations: clean(s, vec![first.clone()]),
        detail,
        pattern,
        unit: None,
        marks,
    };

    let parts = match (&hint.proof, hint.technique) {
        (_, Technique::NakedPair | Technique::NakedTriple | Technique::NakedQuad) => subset(s, hint, &involved, true),
        (_, Technique::HiddenPair | Technique::HiddenTriple | Technique::HiddenQuad) => subset(s, hint, &involved, false),
        (Some(ProofCertificate::Fish { digit, base_sectors, cover_sectors, fins }), t) => {
            let digit = *digit;
            let marks = marks_for(s, &involved, &[digit]);
            if t == Technique::EmptyRectangle {
                let detail = empty_rectangle(s, digit, base_sectors, cover_sectors, &involved, first.cell).unwrap_or(Detail::Other);
                Some(alone(detail, involved.clone(), marks))
            } else if matches!(t, Technique::PointingPair | Technique::BoxLineReduction) {
                let (from, to) = (base_sectors[0], cover_sectors[0]);
                Some(Parts {
                    detail: Detail::Intersection { pointing: t == Technique::PointingPair, digit, from, to },
                    eliminations: fish_targets(s, digit, base_sectors, cover_sectors, fins),
                    pattern: involved.clone(),
                    unit: Some(from),
                    marks,
                })
            } else {
                Some(Parts {
                    detail: Detail::Fish { digit, bases: base_sectors.clone(), covers: cover_sectors.clone(), fins: fins.clone() },
                    eliminations: fish_targets(s, digit, base_sectors, cover_sectors, fins),
                    pattern: involved.clone(),
                    unit: None,
                    marks,
                })
            }
        }
        (Some(ProofCertificate::Als { als_chain, rcc_values, z_value }), _) => {
            let sets: Vec<AlsSet> =
                als_chain.iter().map(|a| AlsSet { cells: a.cells.clone(), digits: a.candidates.clone(), unit: a.sector }).collect();
            let pattern = dedup(sets.iter().flat_map(|a| a.cells.iter().copied()));
            let key: Vec<u8> = match z_value {
                Some(z) => vec![*z],
                None => first.values.clone(),
            };
            let marks = marks_for(s, &pattern, &key);
            let eliminations = match z_value {
                Some(z) => als_targets(s, &sets, *z),
                None => sue_de_coq_targets(s, &sets),
            };
            Some(Parts { detail: Detail::Als { sets, links: rcc_values.clone(), z: *z_value }, eliminations, pattern, unit: None, marks })
        }
        (Some(ProofCertificate::Aic { chain, .. }), t) => {
            let nodes: Vec<ChainNode> = chain.iter().map(node).collect();
            let pattern = dedup(nodes.iter().map(|n| n.cell));
            let marks = dedup_marks(nodes.iter().map(|n| (n.cell, n.digit)));
            // Deprecated in sudoku-core (subsumed by AIC) but still returned, with unordered nodes.
            #[allow(deprecated)]
            let coloring = t == Technique::ThreeDMedusa;
            if coloring {
                Some(alone(Detail::Coloring { nodes }, pattern, marks))
            } else {
                let eliminations = chain_targets(s, &nodes);
                Some(Parts { detail: Detail::Chain { nodes }, eliminations, pattern, unit: None, marks })
            }
        }
        (Some(ProofCertificate::Uniqueness { floor_cells, roof_cells, .. }), _) => {
            let corners = dedup(floor_cells.iter().chain(roof_cells).copied());
            let pair = floor_cells.iter().fold(0x3fe, |m, &c| m & s.masks[c]);
            let digits = digits_of(pair);
            let marks = marks_for(s, &corners, &digits);
            Some(alone(Detail::Rectangle { corners: corners.clone(), digits }, corners, marks))
        }
        _ => None,
    };
    match parts {
        // The computed targets must hold what the engine found; otherwise its elimination alone.
        Some(parts) if contains(&parts.eliminations, &first) => parts,
        _ => {
            let marks = marks_for(s, &involved, &first.values);
            alone(Detail::Other, involved.clone(), marks)
        }
    }
}

fn dedup_marks(marks: impl IntoIterator<Item = (usize, u8)>) -> Vec<(usize, u8)> {
    let mut out = Vec::new();
    for m in marks {
        if !out.contains(&m) {
            out.push(m);
        }
    }
    out
}

/// Hint on the caller's candidates, without recalculating them. `masks[i]` holds cell i's
/// candidates, bit v set for digit v; ignored for filled cells. Singles on the candidates of the
/// placed values alone (the ones anyone can see) come first.
pub fn hint_on(puzzle: &str, masks: &[u16]) -> Result<Option<AppHint>, String> {
    let s = State::parse(puzzle, masks)?;
    if !s.values.contains(&0) {
        return Ok(None);
    }
    if let Some((cell, value, unit)) = find_single(&s.basic()) {
        return Ok(Some(single_hint(cell, value, unit)));
    }
    let solver = Solver::new();
    let Some(hint) = solver.get_hint_with_candidates(&s.grid()) else {
        return Ok(None);
    };
    let parts = convert(&s, &hint);
    let mut technique = hint.technique.to_string();
    if hint.technique == Technique::PointingPair && parts.pattern.len() == 3 {
        technique = "Pointing Triple".to_string();
    }
    let place = match hint.hint_type {
        HintType::SetValue { pos, value } => Some(Placement { cell: index(pos), value }),
        HintType::EliminateCandidates { .. } => None,
    };
    Ok(Some(AppHint {
        technique,
        backtracking: hint.technique == Technique::Backtracking,
        place,
        eliminations: parts.eliminations,
        pattern: parts.pattern,
        unit: parts.unit,
        marks: parts.marks,
        detail: parts.detail,
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
    let grid = Grid::from_string(puzzle).ok_or_else(|| JsError::new("invalid puzzle"))?;
    let (difficulty, se) = Solver::new().analyze(&grid);
    Ok(serde_json::json!({ "level": difficulty.to_string(), "se": se }).to_string())
}

/// A puzzle entered by the player. Returns JSON: {"solutions": 0|1|2, "level": "...", "solution": "..."}.
/// Counting stops at 2. Level (the engine's `Difficulty`) and solution (81 digits) only with exactly
/// one solution, else null. Givens that break a rule count as no solution.
#[wasm_bindgen]
pub fn check(puzzle: &str) -> Result<String, JsError> {
    let grid = Grid::from_string(puzzle).ok_or_else(|| JsError::new("invalid puzzle"))?;
    let solver = Solver::new();
    let solutions = if grid.validate().is_valid { solver.count_solutions(&grid, 2) } else { 0 };
    let solved = if solutions == 1 { solver.solve(&grid) } else { None };
    let Some(solved) = solved else {
        return Ok(serde_json::json!({ "solutions": solutions, "level": null, "solution": null }).to_string());
    };
    let (difficulty, _) = solver.analyze(&grid);
    Ok(serde_json::json!({
        "solutions": 1,
        "level": difficulty.to_string(),
        "solution": solved.to_string_compact(),
    })
    .to_string())
}
