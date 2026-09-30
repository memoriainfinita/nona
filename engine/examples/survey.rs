// Phase 7 review harness: plays bank puzzles with hints only, through the app's bridge, and
// counts per technique. Every placement and elimination is checked against the stored solution.
// Usage (from engine/): cargo run --release --example survey -- [puzzles per level] [--dump FILE]
// --dump writes one real hint per technique (board, candidates, hint) for the app's text tests.
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::time::Instant;

fn units_of(i: usize) -> [usize; 3] {
    let (r, c) = (i / 9, i % 9);
    [r, 9 + c, 18 + r / 3 * 3 + c / 3]
}

fn peers(i: usize) -> Vec<usize> {
    (0..81).filter(|&p| p != i && units_of(p).iter().any(|u| units_of(i).contains(u))).collect()
}

#[derive(Default)]
struct Stat {
    hints: usize,
    eliminations: usize,
    max_targets: usize,
    repeats: usize,
    dependent_singles: usize,
    other_detail: usize,
    wrong: usize,
    max_ms: f64,
    false_chain_ends: usize,
    levels: BTreeMap<&'static str, usize>,
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let n: usize = args.get(1).and_then(|a| a.parse().ok()).unwrap_or(20);
    let dump = args.iter().position(|a| a == "--dump").map(|i| args[i + 1].clone());
    let peers: Vec<Vec<usize>> = (0..81).map(peers).collect();
    let mut stats: BTreeMap<String, Stat> = BTreeMap::new();
    let mut samples: BTreeMap<String, Value> = BTreeMap::new();
    let mut times: Vec<f64> = Vec::new();
    let bank = concat!(env!("CARGO_MANIFEST_DIR"), "/../bank");
    for level in ["easy", "medium", "intermediate", "hard", "expert", "master"] {
        let rows: Vec<Value> = serde_json::from_str(&std::fs::read_to_string(format!("{bank}/{level}.json")).unwrap()).unwrap();
        for row in rows.iter().take(n) {
            let solution: Vec<u8> = row["solution"].as_str().unwrap().bytes().map(|b| b - b'0').collect();
            let mut cells: Vec<u8> =
                row["puzzle"].as_str().unwrap().bytes().map(|b| if b.is_ascii_digit() { b - b'0' } else { 0 }).collect();
            let basic = |cells: &Vec<u8>, i: usize| -> u16 {
                if cells[i] != 0 {
                    0
                } else {
                    peers[i].iter().fold(0x3fe, |m, &p| m & !(1 << cells[p]))
                }
            };
            let mut masks = [0u16; 81];
            for i in 0..81 {
                masks[i] = basic(&cells, i);
            }
            let mut prev: Option<String> = None;
            while cells.contains(&0) {
                let board: String = cells.iter().map(|&v| if v == 0 { '.' } else { (b'0' + v) as char }).collect();
                let t = Instant::now();
                let h = nona_engine::hint_on(&board, &masks).unwrap().expect("hint");
                let ms = t.elapsed().as_secs_f64() * 1e3;
                times.push(ms);
                let key = format!("{} {:?} {:?}", h.technique, h.detail, h.pattern);
                let s = stats.entry(h.technique.clone()).or_default();
                s.hints += 1;
                s.max_ms = s.max_ms.max(ms);
                *s.levels.entry(level).or_default() += 1;
                if prev.as_deref() == Some(key.as_str()) {
                    s.repeats += 1;
                }
                prev = Some(key);
                if let nona_engine::Detail::Chain { nodes } = &h.detail {
                    let (a, b) = (&nodes[0], &nodes[nodes.len() - 1]);
                    if solution[a.cell] != a.digit && solution[b.cell] != b.digit {
                        s.false_chain_ends += 1;
                    }
                }
                if matches!(h.detail, nona_engine::Detail::Other) {
                    s.other_detail += 1;
                }
                let mut sample_kind = h.technique.clone();
                if let Some(p) = &h.place {
                    if h.technique.ends_with("Single") {
                        let b = basic(&cells, p.cell);
                        let visible = b.count_ones() == 1
                            || units_of(p.cell).iter().any(|&u| {
                                (0..81).filter(|&c| units_of(c).contains(&u) && basic(&cells, c) & (1 << p.value) != 0).count() == 1
                            });
                        if !visible {
                            s.dependent_singles += 1;
                            sample_kind = format!("{} (earlier eliminations)", h.technique);
                        }
                    }
                }
                if !samples.contains_key(&sample_kind) {
                    samples.insert(
                        sample_kind.clone(),
                        json!({ "name": sample_kind, "level": level, "seed": row["seed"], "board": board, "masks": masks.to_vec(), "hint": h }),
                    );
                }
                s.eliminations += h.eliminations.len();
                s.max_targets = s.max_targets.max(h.eliminations.len());
                if let Some(p) = &h.place {
                    if solution[p.cell] != p.value {
                        s.wrong += 1;
                    }
                    cells[p.cell] = p.value;
                    masks[p.cell] = 0;
                    for &q in &peers[p.cell] {
                        masks[q] &= !(1 << p.value);
                    }
                } else {
                    assert!(!h.eliminations.is_empty(), "hint without conclusion: {h:?}");
                    for e in &h.eliminations {
                        if e.values.contains(&solution[e.cell]) {
                            s.wrong += 1;
                        }
                        for &v in &e.values {
                            masks[e.cell] &= !(1 << v);
                        }
                    }
                }
            }
        }
    }
    let total = |f: fn(&Stat) -> usize| stats.values().map(f).sum::<usize>();
    for (t, s) in &stats {
        println!(
            "{t:<22} hints {:>6} | cells eliminated {:>5} (max {:>2} per hint) | repeats {} | dependent singles {} | no template {} | wrong {} | false chain ends {} | max {:.1} ms | {:?}",
            s.hints, s.eliminations, s.max_targets, s.repeats, s.dependent_singles, s.other_detail, s.wrong, s.false_chain_ends, s.max_ms, s.levels
        );
    }
    times.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!(
        "TOTAL hints {} | repeats {} | dependent singles {} | no template {} | wrong {} | false chain ends {} | time median {:.2} ms, p99 {:.1} ms, max {:.1} ms",
        total(|s| s.hints),
        total(|s| s.repeats),
        total(|s| s.dependent_singles),
        total(|s| s.other_detail),
        total(|s| s.wrong),
        total(|s| s.false_chain_ends),
        times[times.len() / 2],
        times[times.len() * 99 / 100],
        times[times.len() - 1]
    );
    if let Some(path) = dump {
        let list: Vec<&Value> = samples.values().collect();
        std::fs::write(&path, serde_json::to_string_pretty(&list).unwrap() + "\n").unwrap();
        println!("wrote {} samples to {path}", list.len());
    }
}
