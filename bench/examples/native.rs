// Native counterpart of js/bench.mjs, same bridge functions and counts.
// Usage: cargo run --release --example native [seeded]
use std::time::Instant;

fn main() {
    let seeded = std::env::args().any(|a| a == "seeded");
    for (level, n) in [("medium", 10), ("hard", 5), ("expert", 5), ("master", 3)] {
        for i in 1..=n {
            let t = Instant::now();
            let puzzle = if seeded {
                nona_bridge::generate_seeded(level, i as u64)
            } else {
                nona_bridge::generate(level)
            }
            .unwrap();
            let gen = t.elapsed().as_secs_f64() * 1e3;
            let t = Instant::now();
            let analysis = nona_bridge::analyze(&puzzle).unwrap();
            let analyze = t.elapsed().as_secs_f64() * 1e3;
            let t = Instant::now();
            nona_bridge::hint(&puzzle).unwrap();
            let hint = t.elapsed().as_secs_f64() * 1e3;
            println!("{level} #{i}: gen {gen:.0} ms, analyze {analyze:.1} ms -> {analysis}, hint {hint:.1} ms, {puzzle}");
        }
    }
}
