//! Builds the puzzle bank. Native only; not part of the WASM build.
//!
//!   gen-bank run [--work DIR] [--threads N] [--timeout SECS] [--target N] [--minutes M] [--round-robin]
//!   gen-bank stats [--work DIR]
//!   gen-bank assemble [--work DIR] [--out DIR] [--normal N] [--daily D] [--timeout SECS]
//!   gen-bank verify [--out DIR]
//!   gen-bank one LEVEL SEED        (internal: one generation, JSON on stdout)
//!
//! Each generation runs in a child process so it can be killed at the timeout.
//! Every attempt is appended to WORK/log.jsonl; `run` resumes from it.
//! Seeds: requested level index * 1_000_000 + n, n from 1, so each seed is unique
//! and records which level was requested.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use sudoku_core::{Difficulty, Generator, Solver};

/// Keep in sync with the sudoku-core rev in engine/Cargo.toml.
const ENGINE_REV: &str = "f56364e";
const ENGINE_REPO: &str = "https://github.com/memoriainfinita/sudoku-core";
const LEVELS: [&str; 6] = ["easy", "medium", "intermediate", "hard", "expert", "master"];
const SEED_BLOCK: u64 = 1_000_000;

#[derive(Serialize, Deserialize, Clone, Debug)]
struct Attempt {
    requested: String,
    seed: u64,
    /// "ok", "timeout" or "error".
    status: String,
    /// Level given by `analyze`, lowercase ("beginner" and "extreme" are outside the bank).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    level: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    se: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    puzzle: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    solution: Option<String>,
    ms: u64,
}

impl Attempt {
    fn failed(requested: &str, seed: u64, status: &str, ms: u64) -> Self {
        Attempt {
            requested: requested.to_string(),
            seed,
            status: status.to_string(),
            level: None,
            se: None,
            puzzle: None,
            solution: None,
            ms,
        }
    }

    /// The bank level this attempt counts for, if any.
    fn bank_level(&self) -> Option<&'static str> {
        let level = self.level.as_deref()?;
        self.puzzle.as_ref()?;
        LEVELS.iter().copied().find(|l| *l == level)
    }
}

fn difficulty(level: &str) -> Difficulty {
    match level {
        "easy" => Difficulty::Easy,
        "medium" => Difficulty::Medium,
        "intermediate" => Difficulty::Intermediate,
        "hard" => Difficulty::Hard,
        "expert" => Difficulty::Expert,
        "master" => Difficulty::Master,
        _ => panic!("unknown level {level}"),
    }
}

fn level_index(level: &str) -> u64 {
    LEVELS.iter().position(|l| *l == level).expect("known level") as u64
}

fn arg<T: std::str::FromStr>(args: &[String], name: &str, default: T) -> T {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .map(|v| v.parse().unwrap_or_else(|_| panic!("bad value for {name}")))
        .unwrap_or(default)
}

fn read_log(work: &Path) -> Vec<Attempt> {
    let Ok(file) = fs::File::open(work.join("log.jsonl")) else { return Vec::new() };
    BufReader::new(file)
        .lines()
        .map_while(Result::ok)
        .filter(|l| !l.trim().is_empty())
        .map(|l| serde_json::from_str(&l).expect("valid log line"))
        .collect()
}

/// Child process: generate one puzzle, check it, print the attempt as JSON.
fn one(level: &str, seed: u64) {
    let start = Instant::now();
    let grid = Generator::with_seed(seed).generate(difficulty(level));
    let solver = Solver::new();
    let mut attempt = Attempt::failed(level, seed, "error", 0);
    if solver.has_unique_solution(&grid) {
        if let Some(solution) = solver.solve(&grid) {
            let (rated, se) = solver.analyze(&grid);
            attempt.status = "ok".to_string();
            attempt.level = Some(rated.to_string().to_lowercase());
            attempt.se = Some(se);
            attempt.puzzle = Some(grid.to_string_compact());
            attempt.solution = Some(solution.to_string_compact());
        }
    }
    attempt.ms = start.elapsed().as_millis() as u64;
    println!("{}", serde_json::to_string(&attempt).unwrap());
}

/// Runs `one` in a child process, killing it at the timeout.
fn spawn_one(level: &str, seed: u64, timeout: Duration) -> Attempt {
    let start = Instant::now();
    let elapsed = || start.elapsed().as_millis() as u64;
    let mut child = Command::new(std::env::current_exe().unwrap())
        .args(["one", level, &seed.to_string()])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn child");
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if start.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Attempt::failed(level, seed, "timeout", elapsed());
            }
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(_) => return Attempt::failed(level, seed, "error", elapsed()),
        }
    }
    let mut out = String::new();
    child.stdout.take().unwrap().read_to_string(&mut out).ok();
    serde_json::from_str(out.trim()).unwrap_or_else(|_| Attempt::failed(level, seed, "error", elapsed()))
}

struct State {
    /// Next n per requested level.
    next: HashMap<String, u64>,
    /// Unique accepted puzzles per bank level.
    have: HashMap<&'static str, usize>,
    /// In-flight requests per requested level.
    inflight: HashMap<String, usize>,
    seen: HashSet<String>,
    rr: usize,
    log: fs::File,
}

impl State {
    fn record(&mut self, attempt: &Attempt) {
        if let Some(level) = attempt.bank_level() {
            if self.seen.insert(attempt.puzzle.clone().unwrap()) {
                *self.have.entry(level).or_default() += 1;
            }
        }
    }

    /// Picks the requested level for the next job: round-robin (pilot), or the bank level
    /// furthest from its target, counting in-flight requests as if they will land there.
    fn pick(&mut self, target: usize, round_robin: bool) -> Option<(String, u64)> {
        let level = if round_robin {
            self.rr += 1;
            LEVELS[(self.rr - 1) % LEVELS.len()]
        } else {
            LEVELS
                .iter()
                .map(|l| {
                    let have = self.have.get(l).copied().unwrap_or(0);
                    let pending = self.inflight.get(*l).copied().unwrap_or(0);
                    (have + pending, *l)
                })
                .filter(|(count, _)| *count < target)
                .min()?
                .1
        };
        let n = self.next.entry(level.to_string()).or_insert(1);
        let seed = level_index(level) * SEED_BLOCK + *n;
        *n += 1;
        *self.inflight.entry(level.to_string()).or_default() += 1;
        Some((level.to_string(), seed))
    }
}

fn run(args: &[String]) {
    let work = PathBuf::from(arg(args, "--work", "bank/work".to_string()));
    let threads: usize = arg(args, "--threads", 3);
    let timeout = Duration::from_secs(arg(args, "--timeout", 180));
    let target: usize = arg(args, "--target", 200);
    let minutes: u64 = arg(args, "--minutes", 0);
    let round_robin = args.iter().any(|a| a == "--round-robin");
    fs::create_dir_all(&work).unwrap();

    let previous = read_log(&work);
    let log = OpenOptions::new().create(true).append(true).open(work.join("log.jsonl")).unwrap();
    let mut state = State {
        next: HashMap::new(),
        have: HashMap::new(),
        inflight: HashMap::new(),
        seen: HashSet::new(),
        rr: previous.len(),
        log,
    };
    for a in &previous {
        let n = a.seed - level_index(&a.requested) * SEED_BLOCK;
        let next = state.next.entry(a.requested.clone()).or_insert(1);
        *next = (*next).max(n + 1);
        state.record(a);
    }
    eprintln!("resumed {} attempts; have {:?}", previous.len(), state.have);

    let deadline = (minutes > 0).then(|| Instant::now() + Duration::from_secs(minutes * 60));
    let state = Arc::new(Mutex::new(state));
    let workers: Vec<_> = (0..threads)
        .map(|_| {
            let state = Arc::clone(&state);
            thread::spawn(move || loop {
                if deadline.is_some_and(|d| Instant::now() >= d) {
                    return;
                }
                let Some((level, seed)) = state.lock().unwrap().pick(target, round_robin) else { return };
                let attempt = spawn_one(&level, seed, timeout);
                let mut s = state.lock().unwrap();
                *s.inflight.get_mut(&level).unwrap() -= 1;
                s.record(&attempt);
                writeln!(s.log, "{}", serde_json::to_string(&attempt).unwrap()).unwrap();
                s.log.flush().unwrap();
                eprintln!(
                    "{level} {seed} -> {} {} {} ms | have {:?}",
                    attempt.status,
                    attempt.level.as_deref().unwrap_or("-"),
                    attempt.ms,
                    LEVELS.map(|l| s.have.get(l).copied().unwrap_or(0))
                );
            })
        })
        .collect();
    for w in workers {
        w.join().unwrap();
    }
}

fn stats(args: &[String]) {
    let work = PathBuf::from(arg(args, "--work", "bank/work".to_string()));
    let log = read_log(&work);
    println!("requested     attempts  timeouts  errors  avg_ms  max_ms  cpu_h  -> analyze levels");
    for req in LEVELS {
        let rows: Vec<&Attempt> = log.iter().filter(|a| a.requested == req).collect();
        if rows.is_empty() {
            continue;
        }
        let count = |s: &str| rows.iter().filter(|a| a.status == s).count();
        let oks: Vec<&&Attempt> = rows.iter().filter(|a| a.status == "ok").collect();
        let avg = oks.iter().map(|a| a.ms).sum::<u64>() / oks.len().max(1) as u64;
        let max = oks.iter().map(|a| a.ms).max().unwrap_or(0);
        let cpu_h = rows.iter().map(|a| a.ms).sum::<u64>() as f64 / 3_600_000.0;
        let mut levels: BTreeMap<String, usize> = BTreeMap::new();
        for a in &oks {
            *levels.entry(a.level.clone().unwrap_or_default()).or_default() += 1;
        }
        println!(
            "{req:<13} {:>8}  {:>8}  {:>6}  {avg:>6}  {max:>6}  {cpu_h:>5.2}  {levels:?}",
            rows.len(),
            count("timeout"),
            count("error")
        );
    }
    let mut seen = HashSet::new();
    let mut have: BTreeMap<usize, (&str, usize)> = BTreeMap::new();
    for a in &log {
        if let Some(l) = a.bank_level() {
            if seen.insert(a.puzzle.clone().unwrap()) {
                have.entry(level_index(l) as usize).or_insert((l, 0)).1 += 1;
            }
        }
    }
    let total_h = log.iter().map(|a| a.ms).sum::<u64>() as f64 / 3_600_000.0;
    let have: Vec<_> = have.values().collect();
    println!("unique per bank level: {have:?}; total cpu hours {total_h:.2}");
}

/// One puzzle as stored in bank/<level>.json (no `level`) or bank/daily.json (with `level`).
#[derive(Serialize, Deserialize, Clone)]
struct Entry {
    seed: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    level: Option<String>,
    puzzle: String,
    solution: String,
}

fn read_entries(path: &Path) -> Vec<Entry> {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).expect("valid bank file"),
        Err(_) => Vec::new(),
    }
}

/// One entry per line, so appended batches show as appended lines in diffs.
fn write_entries(path: &Path, entries: &[Entry]) {
    let lines: Vec<String> = entries.iter().map(|e| serde_json::to_string(e).unwrap()).collect();
    fs::write(path, format!("[\n{}\n]\n", lines.join(",\n"))).unwrap();
}

/// Deterministic shuffle for a daily batch (xorshift64*, Fisher-Yates).
fn shuffle<T>(items: &mut [T], seed: u64) {
    let mut state = seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1;
    for i in (1..items.len()).rev() {
        state ^= state >> 12;
        state ^= state << 25;
        state ^= state >> 27;
        let r = state.wrapping_mul(0x2545_F491_4F6C_DD1D);
        items.swap(i, (r % (i as u64 + 1)) as usize);
    }
}

/// Appends a batch to the bank. Existing entries are kept as they are; new puzzles come
/// from the log in seed order, never repeating a puzzle already in either set.
/// --normal N and --daily D are totals per level after this batch.
fn assemble(args: &[String]) {
    let work = PathBuf::from(arg(args, "--work", "bank/work".to_string()));
    let out = PathBuf::from(arg(args, "--out", "bank".to_string()));
    let normal_target: usize = arg(args, "--normal", 0);
    let daily_target: usize = arg(args, "--daily", 0);
    let timeout: u64 = arg(args, "--timeout", 180);
    fs::create_dir_all(&out).unwrap();

    let mut normal: HashMap<&str, Vec<Entry>> =
        LEVELS.iter().map(|l| (*l, read_entries(&out.join(format!("{l}.json"))))).collect();
    let mut daily = read_entries(&out.join("daily.json"));
    let mut used: HashSet<String> = normal.values().flatten().chain(&daily).map(|e| e.puzzle.clone()).collect();
    let daily_have = |l: &str, daily: &[Entry]| daily.iter().filter(|e| e.level.as_deref() == Some(l)).count();

    let mut log = read_log(&work);
    log.sort_by_key(|a| a.seed);
    let mut added: BTreeMap<String, usize> = BTreeMap::new();
    let mut new_daily = Vec::new();
    for l in LEVELS {
        let mut fresh = log.iter().filter(|a| a.bank_level() == Some(l)).filter_map(|a| {
            let puzzle = a.puzzle.clone().unwrap();
            used.insert(puzzle.clone()).then(|| Entry {
                seed: a.seed,
                level: None,
                puzzle,
                solution: a.solution.clone().unwrap(),
            })
        });
        let normal_need = normal_target.saturating_sub(normal[l].len());
        let daily_need = daily_target.saturating_sub(daily_have(l, &daily));
        let taken: Vec<Entry> = fresh.by_ref().take(normal_need + daily_need).collect();
        if taken.len() < normal_need + daily_need {
            eprintln!("{l}: {} new puzzles, need {}", taken.len(), normal_need + daily_need);
            std::process::exit(1);
        }
        let (to_normal, to_daily) = taken.split_at(normal_need);
        normal.get_mut(l).unwrap().extend_from_slice(to_normal);
        new_daily.extend(to_daily.iter().cloned().map(|e| Entry { level: Some(l.to_string()), ..e }));
        added.insert(l.to_string(), normal_need);
    }
    shuffle(&mut new_daily, daily.len() as u64 + 1);
    added.insert("daily".to_string(), new_daily.len());
    if added.values().all(|n| *n == 0) {
        eprintln!("nothing to add: bank already at --normal {normal_target} --daily {daily_target}");
        return;
    }
    daily.extend(new_daily);

    for l in LEVELS {
        write_entries(&out.join(format!("{l}.json")), &normal[l]);
    }
    write_entries(&out.join("daily.json"), &daily);

    let meta_path = out.join("meta.json");
    let mut meta: serde_json::Value = fs::read_to_string(&meta_path)
        .ok()
        .map(|t| serde_json::from_str(&t).expect("valid meta.json"))
        .unwrap_or_else(|| {
            serde_json::json!({
                "format": 1,
                "seeds": "requested level index * 1000000 + n; levels easy, medium, intermediate, hard, expert, master",
                "batches": [],
            })
        });
    meta["batches"].as_array_mut().unwrap().push(serde_json::json!({
        "engine": { "repo": ENGINE_REPO, "rev": ENGINE_REV },
        "generator": format!("gen-bank {}", env!("CARGO_PKG_VERSION")),
        "timeoutSeconds": timeout,
        "added": added,
    }));
    fs::write(&meta_path, serde_json::to_string_pretty(&meta).unwrap() + "\n").unwrap();
    eprintln!("added {added:?} to {}", out.display());
}

/// Re-checks every bank puzzle from scratch: `analyze` gives its level, unique solution,
/// the stored solution is that solution, and no puzzle or seed appears twice.
fn verify(args: &[String]) {
    let out = PathBuf::from(arg(args, "--out", "bank".to_string()));
    let solver = Solver::new();
    let mut sets: Vec<(String, Vec<Entry>)> = LEVELS
        .iter()
        .map(|l| {
            let entries = read_entries(&out.join(format!("{l}.json")));
            (l.to_string(), entries.into_iter().map(|e| Entry { level: Some(l.to_string()), ..e }).collect())
        })
        .collect();
    sets.push(("daily".to_string(), read_entries(&out.join("daily.json"))));
    let mut puzzles = HashSet::new();
    let mut seeds = HashSet::new();
    let mut bad = 0;
    for (name, entries) in &sets {
        for e in entries {
            let level = e.level.as_deref().unwrap_or("?");
            let problem = if !puzzles.insert(e.puzzle.clone()) || !seeds.insert(e.seed) {
                Some("duplicate puzzle or seed".to_string())
            } else if let Some(grid) = sudoku_core::Grid::from_string(&e.puzzle) {
                let rated = solver.analyze(&grid).0.to_string().to_lowercase();
                let unique = solver.has_unique_solution(&grid);
                let matches = solver.solve(&grid).map(|g| g.to_string_compact()).as_deref() == Some(e.solution.as_str());
                (rated != level || !unique || !matches)
                    .then(|| format!("analyze {rated}, unique {unique}, solution matches {matches}"))
            } else {
                Some("unparsable".to_string())
            };
            if let Some(problem) = problem {
                eprintln!("{name} {} ({level}): {problem}", e.seed);
                bad += 1;
            }
        }
        eprintln!("{name}: {} checked", entries.len());
    }
    if bad > 0 {
        eprintln!("{bad} bad puzzles");
        std::process::exit(1);
    }
    eprintln!("all puzzles verified");
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("one") => one(&args[1], args[2].parse().expect("seed")),
        Some("run") => run(&args[1..]),
        Some("stats") => stats(&args[1..]),
        Some("assemble") => assemble(&args[1..]),
        Some("verify") => verify(&args[1..]),
        _ => {
            eprintln!("usage: gen-bank run|stats|assemble|one (see source header)");
            std::process::exit(2);
        }
    }
}
