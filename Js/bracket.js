// Pure bracket logic (no DOM, no network) so it can be tested in Node.

export function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const len = order.length * 2;
    order = order.flatMap((s) => [s, len + 1 - s]);
  }
  return order;
}

export function roundLabel(teamsInRound) {
  if (teamsInRound === 2) return 'ชิงชนะเลิศ';
  if (teamsInRound === 4) return 'รองชนะเลิศ';
  return `รอบ ${teamsInRound} ทีม`;
}

// teams: registration ids, best seed first. Returns match rows ready to insert.
export function buildKnockout(teams, { tournamentId, categoryId, uuid }) {
  const n = teams.length;
  if (n < 2) throw new Error('ต้องมีอย่างน้อย 2 ทีม');
  const size = 2 ** Math.ceil(Math.log2(n));
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const grid = []; // grid[r][i] = match row
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    const teamsInRound = size / 2 ** (r - 1);
    grid.push(
      Array.from({ length: count }, (_, i) => ({
        id: uuid(),
        tournament_id: tournamentId,
        category_id: categoryId,
        round: r,
        round_label: roundLabel(teamsInRound),
        slot: i,
        reg_a: null,
        reg_b: null,
        status: 'scheduled',
        winner: null,
        next_match: null,
        next_slot: null,
      }))
    );
  }
  for (let r = 0; r < rounds - 1; r++) {
    grid[r].forEach((m, i) => {
      m.next_match = grid[r + 1][Math.floor(i / 2)].id;
      m.next_slot = i % 2 === 0 ? 'a' : 'b';
    });
  }
  const seat = (s) => (s <= n ? teams[s - 1] : null);
  grid[0].forEach((m, i) => {
    m.reg_a = seat(order[2 * i]);
    m.reg_b = seat(order[2 * i + 1]);
  });
  // byes: the lone team advances immediately
  const slotOf = {};
  grid.flat().forEach((m) => (slotOf[m.id] = m));
  grid[0].forEach((m) => {
    if ((m.reg_a && !m.reg_b) || (!m.reg_a && m.reg_b)) {
      m.status = 'finished';
      m.winner = m.reg_a || m.reg_b;
      const nx = slotOf[m.next_match];
      if (m.next_slot === 'a') nx.reg_a = m.winner;
      else nx.reg_b = m.winner;
    }
  });
  // matches reference later rounds, so order rows from the final backwards
  return grid.flat().reverse();
}

// Circle method. Returns match rows; bye rounds are skipped.
export function buildRoundRobin(teams, { tournamentId, categoryId, uuid }) {
  if (teams.length < 2) throw new Error('ต้องมีอย่างน้อย 2 ทีม');
  const list = teams.slice();
  if (list.length % 2) list.push(null);
  const n = list.length;
  const rows = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) {
        rows.push({
          id: uuid(),
          tournament_id: tournamentId,
          category_id: categoryId,
          round: r + 1,
          round_label: `นัดที่ ${r + 1}`,
          slot: i,
          reg_a: a,
          reg_b: b,
          status: 'scheduled',
        });
      }
    }
    list.splice(1, 0, list.pop());
  }
  return rows;
}

// Round-robin standings from finished matches.
export function standings(teams, matches) {
  const row = {};
  teams.forEach((t) => (row[t] = { id: t, played: 0, won: 0, lost: 0, gf: 0, ga: 0, pf: 0, pa: 0 }));
  for (const m of matches) {
    if (m.status !== 'finished' || !row[m.reg_a] || !row[m.reg_b]) continue;
    const A = row[m.reg_a];
    const B = row[m.reg_b];
    A.played++; B.played++;
    for (const [x, y] of m.sets) {
      A.pf += x; A.pa += y; B.pf += y; B.pa += x;
      if (x > y) { A.gf++; B.ga++; } else { B.gf++; A.ga++; }
    }
    if (m.winner === m.reg_a) { A.won++; B.lost++; } else { B.won++; A.lost++; }
  }
  return Object.values(row).sort(
    (p, q) => q.won - p.won || (q.gf - q.ga) - (p.gf - p.ga) || (q.pf - q.pa) - (p.pf - p.pa)
  );
}

// Assign courts and times to unfinished matches: round by round, cycling the courts.
export function autoSchedule(matches, { courts, start, minutesPerMatch }) {
  const todo = matches
    .filter((m) => m.status !== 'finished')
    .slice()
    .sort((a, b) => a.round - b.round || String(a.category_id).localeCompare(String(b.category_id)) || a.slot - b.slot);
  return todo.map((m, i) => ({
    id: m.id,
    court: (i % courts) + 1,
    scheduled_at: new Date(start.getTime() + Math.floor(i / courts) * minutesPerMatch * 60000).toISOString(),
  }));
}
