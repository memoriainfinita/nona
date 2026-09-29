// Plays a puzzle to the end using only hint_with_candidates, timing every call.
// Candidates live on the JS side, as in the app: masks[i] has bit v set for digit v.
const PEERS = Array.from({ length: 81 }, (_, i) => {
  const r = Math.floor(i / 9), c = i % 9, br = r - (r % 3), bc = c - (c % 3);
  const set = new Set();
  for (let k = 0; k < 9; k++) {
    set.add(r * 9 + k);
    set.add(k * 9 + c);
    set.add((br + Math.floor(k / 3)) * 9 + bc + (k % 3));
  }
  set.delete(i);
  return [...set];
});

export function play(m, puzzle, now) {
  const cells = [...puzzle].map((ch) => (ch === '.' || ch === '0' ? 0 : Number(ch)));
  const masks = new Uint16Array(81);
  cells.forEach((v, i) => {
    if (v) return;
    let mask = 0x3fe;
    for (const p of PEERS[i]) if (cells[p]) mask &= ~(1 << cells[p]);
    masks[i] = mask;
  });
  const times = [];
  const techniques = {};
  const seen = new Set();
  let eliminations = 0;
  const fail = (error) => ({ puzzle, error, steps: times.length, eliminations, times, techniques });
  while (cells.includes(0)) {
    const board = cells.map((v) => v || '.').join('');
    const t = now();
    const hint = JSON.parse(m.hint_with_candidates(board, masks));
    times.push(now() - t);
    if (!hint) return fail('no hint');
    techniques[hint.technique] = (techniques[hint.technique] ?? 0) + 1;
    const { SetValue: set, EliminateCandidates: elim } = hint.hint_type;
    if (set) {
      const i = set.pos.row * 9 + set.pos.col;
      if (cells[i] || !(masks[i] & (1 << set.value))) return fail(`bad placement ${JSON.stringify(set)}`);
      cells[i] = set.value;
      masks[i] = 0;
      for (const p of PEERS[i]) masks[p] &= ~(1 << set.value);
    } else {
      const key = JSON.stringify(elim);
      if (seen.has(key)) return fail(`repeated elimination ${key}`);
      seen.add(key);
      eliminations++;
      const i = elim.pos.row * 9 + elim.pos.col;
      for (const v of elim.values) masks[i] &= ~(1 << v);
      if (!masks[i]) return fail(`no candidates left at ${i}`);
    }
  }
  const units = PEERS.map((_, i) => i);
  const valid = units.every((i) => PEERS[i].every((p) => cells[p] !== cells[i]));
  return valid ? { puzzle, steps: times.length, eliminations, times, techniques } : fail('invalid final grid');
}

export function summarize(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1];
  return { median: sorted[Math.floor(sorted.length / 2)], max, maxStep: times.indexOf(max) + 1, total: times.reduce((a, b) => a + b, 0) };
}
