import {
  sb, html, mount, $, $$, raw, toast, errMsg, fmtRange, fmtTime, fmtDate, baht,
  STATUS_TH, REG_STATUS_TH, publicUrl, teamName,
} from './lib.js';
import { standings } from './bracket.js';

// ------------------------------------------------------------------ home
export async function home(root) {
  mount(root, html`<section class="wrap"><div class="skeleton">กำลังโหลด…</div></section>`);
  const { data, error } = await sb
    .from('tournaments')
    .select('id,slug,name,venue,start_date,end_date,status,reg_deadline')
    .neq('status', 'draft')
    .order('start_date', { ascending: false, nullsFirst: false });
  if (error) return mount(root, html`<section class="wrap"><p class="err">${errMsg(error)}</p></section>`);
  mount(
    root,
    html`<section class="wrap">
      <div class="hero-plain">
        <h1>รายการแข่งขันแบดมินตัน</h1>
        <p>เลือกรายการที่เปิดรับสมัคร หรือเข้าดูคะแนนสดของรายการที่กำลังแข่ง</p>
      </div>
      <div class="grid">
        ${data.length
          ? data.map(
              (t) => html`<a class="card tcard" href="#/t/${t.slug}">
                <span class="pill st-${t.status}">${STATUS_TH[t.status]}</span>
                <h2>${t.name}</h2>
                <span class="muted">${fmtRange(t.start_date, t.end_date)}${t.venue ? ' · ' + t.venue : ''}</span>
              </a>`
            )
          : html`<p class="muted">ยังไม่มีรายการที่เปิดให้ดู</p>`}
      </div>
    </section>`
  );
}

// ------------------------------------------------------------------ tournament page
export async function tournamentPage(root, slug) {
  mount(root, html`<section class="wrap"><div class="skeleton">กำลังโหลด…</div></section>`);
  const { data: t, error } = await sb.from('tournaments').select('*').eq('slug', slug).maybeSingle();
  if (error) return mount(root, html`<section class="wrap"><p class="err">${errMsg(error)}</p></section>`);
  if (!t) return mount(root, html`<section class="wrap"><p class="err">ไม่พบรายการนี้</p><a href="#/">กลับหน้าแรก</a></section>`);

  const [cats, posters, entries, matches] = await Promise.all([
    sb.from('categories').select('*').eq('tournament_id', t.id).order('sort').order('name'),
    sb.from('tournament_posters').select('*').eq('tournament_id', t.id).order('sort').order('created_at'),
    sb.rpc('public_entries', { p_tournament: t.id }),
    sb.from('matches').select('*').eq('tournament_id', t.id).order('round').order('slot'),
  ]);
  const S = {
    t,
    cats: cats.data || [],
    posters: posters.data || [],
    entries: entries.data || [],
    matches: matches.data || [],
    tab: t.status === 'live' ? 'courts' : 'info',
    catId: null,
  };
  S.catId = S.cats[0]?.id || null;

  const render = () => draw(root, S, render);
  render();

  // live updates
  let timer;
  const channel = sb
    .channel(`t-${t.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${t.id}` }, (p) => {
      if (p.eventType === 'DELETE') S.matches = S.matches.filter((m) => m.id !== p.old.id);
      else {
        const i = S.matches.findIndex((m) => m.id === p.new.id);
        if (i >= 0) S.matches[i] = p.new;
        else S.matches.push(p.new);
      }
      clearTimeout(timer);
      timer = setTimeout(render, 150);
    })
    .subscribe();
  return () => sb.removeChannel(channel);
}

function draw(root, S, render) {
  const { t } = S;
  const nameOf = (id, m) => {
    if (!id) return m && m.round === 1 && m.status === 'finished' ? 'ผ่านเข้ารอบ (บาย)' : 'รอผลการแข่ง';
    return teamName(S.entries.find((e) => e.id === id));
  };
  const counts = {};
  S.entries.forEach((e) => {
    if (e.status === 'pending' || e.status === 'confirmed') counts[e.category_id] = (counts[e.category_id] || 0) + 1;
  });
  const canRegister = t.status === 'open' && (!t.reg_deadline || new Date(t.reg_deadline) > new Date());
  const hero = S.posters[0] ? publicUrl('posters', S.posters[0].path) : '';

  const tabs = [
    ['info', 'ข้อมูล'],
    ['entries', 'รายชื่อ'],
    ['bracket', 'สายแข่ง'],
    ['courts', 'คอร์ต'],
  ];

  let body;
  if (S.tab === 'info') body = infoTab(S, counts);
  else if (S.tab === 'entries') body = entriesTab(S);
  else if (S.tab === 'bracket') body = bracketTab(S, nameOf);
  else body = courtsTab(S, nameOf);

  mount(
    root,
    html`<section class="wrap">
      <a class="back" href="#/">← รายการทั้งหมด</a>
      <header class="thead">
        ${hero ? html`<img class="poster" src="${hero}" alt="โปสเตอร์ ${t.name}">` : ''}
        <div class="thead-text">
          <span class="pill st-${t.status}">${STATUS_TH[t.status]}</span>
          <h1>${t.name}</h1>
          <p class="muted">${fmtRange(t.start_date, t.end_date)}${t.venue ? ' · ' + t.venue : ''} · ${t.courts} คอร์ต</p>
          ${t.reg_deadline && t.status === 'open' ? html`<p class="muted">ปิดรับสมัคร ${fmtDate(t.reg_deadline)}</p>` : ''}
          ${canRegister ? html`<a class="btn primary" href="#/t/${t.slug}/register">สมัครแข่งขัน</a>` : ''}
        </div>
      </header>
      ${S.posters.length > 1
        ? html`<div class="strip">${S.posters.slice(1).map((p) => html`<a href="${publicUrl('posters', p.path)}" target="_blank" rel="noopener"><img src="${publicUrl('posters', p.path)}" alt="โปสเตอร์เพิ่มเติม" loading="lazy"></a>`)}</div>`
        : ''}
      <nav class="tabs" role="tablist">
        ${tabs.map(([k, label]) => html`<button type="button" role="tab" aria-selected="${S.tab === k}" data-tab="${k}">${label}</button>`)}
      </nav>
      <div class="tabbody">${body}</div>
    </section>`
  );

  $$('[data-tab]', root).forEach((b) =>
    b.addEventListener('click', () => {
      S.tab = b.dataset.tab;
      render();
    })
  );
  const sel = $('#cat-select', root);
  if (sel)
    sel.addEventListener('change', () => {
      S.catId = sel.value;
      render();
    });
}

function infoTab(S, counts) {
  const { t, cats } = S;
  const r = t.rules || {};
  return html`
    ${t.description ? html`<div class="card prose">${t.description}</div>` : ''}
    <div class="card">
      <h2>ประเภทที่เปิดแข่ง</h2>
      ${cats.length
        ? html`<div class="tablewrap"><table>
            <thead><tr><th>ประเภท</th><th>ค่าสมัคร</th><th>สมัครแล้ว</th><th>รูปแบบ</th></tr></thead>
            <tbody>${cats.map((c) => {
              const n = counts[c.id] || 0;
              return html`<tr>
                <td>${c.name}</td><td>${c.fee ? baht(c.fee) : 'ฟรี'}</td>
                <td>${n} / ${c.max_teams}${n >= c.max_teams ? html` <span class="pill st-closed">เต็ม รับสำรอง</span>` : ''}</td>
                <td>${c.format === 'round_robin' ? 'พบกันหมด' : 'แพ้คัดออก'}</td></tr>`;
            })}</tbody></table></div>`
        : html`<p class="muted">ผู้จัดยังไม่ได้กำหนดประเภท</p>`}
    </div>
    <div class="card">
      <h2>กติกา</h2>
      <p>เกมละ ${r.points || 21} แต้ม · ชนะ ${Math.floor((r.best_of || 3) / 2) + 1} ใน ${r.best_of || 3} เกม · เสมอ ${(r.points || 21) - 1} ต่อได้ถึง ${r.cap || 30} แต้ม</p>
    </div>`;
}

function entriesTab(S) {
  const { cats, entries } = S;
  if (!entries.length) return html`<p class="muted">ยังไม่มีผู้สมัคร</p>`;
  return html`${cats.map((c) => {
    const list = entries.filter((e) => e.category_id === c.id);
    if (!list.length) return '';
    return html`<div class="card">
      <h2>${c.name} <span class="muted">(${list.length} ทีม)</span></h2>
      <div class="entries">${list.map((e) => html`<div class="entry">
        <span class="avatars">
          ${avatar(e.p1_photo, e.p1_nick || e.p1_name)}${e.p2_name ? avatar(e.p2_photo, e.p2_nick || e.p2_name) : ''}
        </span>
        <span class="ename"><b>${e.p1_name}</b>${e.p2_name ? html`<br><b>${e.p2_name}</b>` : ''}</span>
        <span class="pill rs-${e.status}">${REG_STATUS_TH[e.status]}</span>
      </div>`)}</div>
    </div>`;
  })}`;
}

const avatar = (path, name) =>
  path
    ? html`<img class="avatar" src="${publicUrl('photos', path)}" alt="${name}" loading="lazy">`
    : html`<span class="avatar ph" aria-hidden="true">${[...name][0]}</span>`;

function matchCard(m, nameOf) {
  const live = m.status === 'live';
  const wonA = m.winner && m.winner === m.reg_a;
  const wonB = m.winner && m.winner === m.reg_b;
  const sa = (m.sets || []).map((s) => s[0]);
  const sbs = (m.sets || []).map((s) => s[1]);
  const row = (reg, scores, cur, won) => html`<div class="mrow ${won ? 'won' : ''}">
    <span class="mname">${nameOf(reg, m)}</span>
    <span class="mscore">${scores.map((x) => html`<b>${x}</b>`)}${live ? html`<b class="cur">${cur}</b>` : ''}</span>
  </div>`;
  return html`<div class="match ${live ? 'is-live' : ''}">
    <div class="mmeta">
      <span>${m.round_label || ''}</span>
      <span>${m.court ? 'คอร์ต ' + m.court : ''}${m.scheduled_at ? ' · ' + fmtTime(m.scheduled_at) : ''}</span>
      ${live ? html`<span class="pill live">สด</span>` : ''}
    </div>
    ${row(m.reg_a, sa, m.cur_a, wonA)}${row(m.reg_b, sbs, m.cur_b, wonB)}
  </div>`;
}

function bracketTab(S, nameOf) {
  const { cats, matches, entries, catId } = S;
  if (!cats.length) return html`<p class="muted">ยังไม่มีประเภท</p>`;
  const cat = cats.find((c) => c.id === catId) || cats[0];
  const list = matches.filter((m) => m.category_id === cat.id);
  const picker = html`<label class="field inline"><span>ประเภท</span>
    <select id="cat-select">${cats.map((c) => html`<option value="${c.id}" ${c.id === cat.id ? raw('selected') : ''}>${c.name}</option>`)}</select></label>`;
  if (!list.length) return html`${picker}<p class="muted">ยังไม่ประกาศสายแข่งของประเภทนี้</p>`;

  if (cat.format === 'round_robin') {
    const ids = [...new Set(list.flatMap((m) => [m.reg_a, m.reg_b]).filter(Boolean))];
    const rows = standings(ids, list);
    return html`${picker}
      <div class="card"><h2>ตารางคะแนน</h2><div class="tablewrap"><table>
        <thead><tr><th>#</th><th>ทีม</th><th>แข่ง</th><th>ชนะ</th><th>แพ้</th><th>เกม +/−</th><th>แต้ม +/−</th></tr></thead>
        <tbody>${rows.map((r, i) => html`<tr><td>${i + 1}</td><td>${nameOf(r.id)}</td><td>${r.played}</td><td>${r.won}</td><td>${r.lost}</td><td>${r.gf - r.ga}</td><td>${r.pf - r.pa}</td></tr>`)}</tbody>
      </table></div></div>
      <div class="matchgrid">${list.map((m) => matchCard(m, nameOf))}</div>`;
  }

  const rounds = [...new Set(list.map((m) => m.round))].sort((a, b) => a - b);
  return html`${picker}<div class="bracket">${rounds.map((r) => {
    const ms = list.filter((m) => m.round === r);
    return html`<div class="round"><h3>${ms[0].round_label}</h3>${ms.map((m) => matchCard(m, nameOf))}</div>`;
  })}</div>`;
}

function courtsTab(S, nameOf) {
  const { t, matches } = S;
  const catName = (id) => S.cats.find((c) => c.id === id)?.name || '';
  const courts = Array.from({ length: t.courts }, (_, i) => i + 1);
  const rank = (m) => (m.scheduled_at ? new Date(m.scheduled_at).getTime() : 1e15) + m.round;
  const live = matches.some((m) => m.status === 'live');
  return html`
    ${live ? '' : html`<p class="muted">ยังไม่มีแมตช์ที่กำลังแข่ง</p>`}
    <div class="courts">${courts.map((n) => {
      const here = matches.filter((m) => m.court === n && m.reg_a && m.reg_b);
      const now = here.find((m) => m.status === 'live');
      const next = here.filter((m) => m.status === 'scheduled').sort((a, b) => rank(a) - rank(b))[0];
      return html`<div class="court ${now ? 'busy' : ''}">
        <div class="court-head"><b>คอร์ต ${n}</b>${now ? html`<span class="pill live">สด</span>` : html`<span class="pill st-closed">ว่าง</span>`}</div>
        ${now
          ? html`<div class="muted">${catName(now.category_id)} · ${now.round_label}</div>${matchCard(now, nameOf)}`
          : next
          ? html`<div class="muted">แมตช์ถัดไป · ${catName(next.category_id)}${next.scheduled_at ? ' · ' + fmtTime(next.scheduled_at) : ''}</div>${matchCard(next, nameOf)}`
          : html`<div class="muted">ไม่มีแมตช์ต่อไป</div>`}
      </div>`;
    })}</div>`;
}
