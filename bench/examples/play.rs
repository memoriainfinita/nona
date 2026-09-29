// Native counterpart of js/play.mjs: plays each seeded puzzle with hint_with_candidates only.
// Puzzles come from js/puzzles-seeded.json, written once by `play gen` (seeds 1..n per level).
// Usage: cargo run --release --example play [gen]
use serde_json::Value;
use std::time::Instant;

fn peers(i: usize) -> Vec<usize> {
    let (r, c) = (i / 9, i % 9);
    let (br, bc) = (r - r % 3, c - c % 3);
    let mut out: Vec<usize> = (0..9)
        .flat_map(|k| [r * 9 + k, k * 9 + c, (br + k / 3) * 9 + bc + k % 3])
        .filter(|&p| p != i)
        .collect();
    out.sort_unstable();
    out.dedup();
    out
}

fn play(puzzle: &str, peers: &[Vec<usize>]) -> Result<(Vec<f64>, usize), String> {
    let mut cells: Vec<u8> = puzzle.bytes().map(|b| if b.is_ascii_digit() { b - b'0' } else { 0 }).collect();
    let mut masks = [0u16; 81];
    for i in 0..81 {
        if cells[i] == 0 {
            masks[i] = peers[i].iter().fold(0x3fe, |m, &p| m & !(1 << cells[p]));
        }
    }
    let (mut times, mut eliminations, mut seen) = (Vec::new(), 0, std::collections::HashSet::new());
    while cells.contains(&0) {
        let board: String = cells.iter().map(|&v| if v == 0 { '.' } else { (b'0' + v) as char }).collect();
        let t = Instant::now();
        let hint: Value = serde_json::from_str(&nona_bridge::hint_with_candidates(&board, &masks).unwrap()).unwrap();
        times.push(t.elapsed().as_secs_f64() * 1e3);
        let ht = hint.get("hint_type").ok_or("no hint")?;
        if let Some(set) = ht.get("SetValue") {
            let i = (set["pos"]["row"].as_u64().unwrap() * 9 + set["pos"]["col"].as_u64().unwrap()) as usize;
            let v = set["value"].as_u64().unwrap() as u8;
            if cells[i] != 0 || masks[i] & (1 << v) == 0 {
                return Err(format!("bad placement {set}"));
            }
            cells[i] = v;
            masks[i] = 0;
            for &p in &peers[i] {
                masks[p] &= !(1 << v);
            }
        } else {
            let elim = &ht["EliminateCandidates"];
            if !seen.insert(elim.to_string()) {
                return Err(format!("repeated elimination {elim}"));
            }
            eliminations += 1;
            let i = (elim["pos"]["row"].as_u64().unwrap() * 9 + elim["pos"]["col"].as_u64().unwrap()) as usize;
            for v in elim["values"].as_array().unwrap() {
                masks[i] &= !(1 << v.as_u64().unwrap());
            }
            if masks[i] == 0 {
                return Err(format!("no candidates left at {i}"));
            }
        }
    }
    if (0..81).any(|i| peers[i].iter().any(|&p| cells[p] == cells[i])) {
        return Err("invalid final grid".into());
    }
    Ok((times, eliminations))
}

fn generate() {
    let mut rows = Vec::new();
    for (level, n) in [("medium", 10), ("hard", 5), ("expert", 5), ("master", 3)] {
        for seed in 1..=n {
            let puzzle = nona_bridge::generate_seeded(level, seed).unwrap();
            println!("{level} seed {seed}: {puzzle}");
            rows.push(serde_json::json!({ "level": level, "seed": seed, "puzzle": puzzle }));
        }
    }
    std::fs::write("js/puzzles-seeded.json", serde_json::to_string_pretty(&rows).unwrap()).unwrap();
}

fn main() {
    if std::env::args().any(|a| a == "gen") {
        return generate();
    }
    let peers: Vec<Vec<usize>> = (0..81).map(peers).collect();
    let rows: Vec<Value> = serde_json::from_str(&std::fs::read_to_string("js/puzzles-seeded.json").unwrap()).unwrap();
    for row in rows.iter().filter(|r| r["puzzle"].is_string()) {
        let level = row["level"].as_str().unwrap();
        match play(row["puzzle"].as_str().unwrap(), &peers) {
            Err(e) => println!("{level}: {e}"),
            Ok((times, elim)) => {
                let mut sorted = times.clone();
                sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
                let max = sorted[sorted.len() - 1];
                let step = times.iter().position(|&t| t == max).unwrap() + 1;
                println!(
                    "{level}: {} hints ({elim} elim), median {:.2} ms, max {max:.1} ms at step {step}, total {:.0} ms",
                    times.len(),
                    sorted[sorted.len() / 2],
                    times.iter().sum::<f64>()
                );
            }
        }
    }
}
