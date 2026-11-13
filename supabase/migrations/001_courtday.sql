-- CourtDay phase 1: organizers, tournaments, registration, payment slips, brackets, live scoring.
-- Multi-tenant boundary: tournaments.organizer_id = auth.uid() of the renting organizer.

-- ---------------------------------------------------------------- tables
create table public.organizers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers(id) on delete cascade,
  slug text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  name text not null check (char_length(name) between 3 and 120),
  venue text,
  description text,
  start_date date,
  end_date date,
  reg_deadline timestamptz,
  courts int not null default 4 check (courts between 1 and 40),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'live', 'finished')),
  promptpay_id text check (promptpay_id is null or promptpay_id ~ '^[0-9]{10}$|^[0-9]{13}$|^[0-9]{15}$'),
  rules jsonb not null default '{"points":21,"best_of":3,"cap":30}'::jsonb,
  created_at timestamptz not null default now()
);
create index tournaments_organizer_idx on public.tournaments (organizer_id);

create table public.tournament_posters (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  path text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index tournament_posters_tournament_idx on public.tournament_posters (tournament_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('singles', 'doubles')),
  level text,
  max_teams int not null default 32 check (max_teams between 2 and 512),
  fee int not null default 0 check (fee >= 0),
  format text not null default 'knockout' check (format in ('knockout', 'round_robin')),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index categories_tournament_idx on public.categories (tournament_id);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'waitlist', 'cancelled')),
  pay_status text not null default 'unpaid' check (pay_status in ('unpaid', 'slip_sent', 'paid', 'rejected')),
  slip_path text,
  edit_token uuid not null default gen_random_uuid(),
  p1_name text not null check (char_length(p1_name) between 1 and 80),
  p1_nick text check (char_length(p1_nick) <= 40),
  p1_phone text check (char_length(p1_phone) <= 20),
  p1_birth_year int check (p1_birth_year between 1930 and 2030),
  p1_photo text,
  p2_name text check (char_length(p2_name) <= 80),
  p2_nick text check (char_length(p2_nick) <= 40),
  p2_phone text check (char_length(p2_phone) <= 20),
  p2_birth_year int check (p2_birth_year between 1930 and 2030),
  p2_photo text,
  video_url text check (video_url is null or (char_length(video_url) <= 300 and video_url ~* '^https?://')),
  seed int,
  note text,
  created_at timestamptz not null default now()
);
create index registrations_tournament_idx on public.registrations (tournament_id);
create index registrations_category_idx on public.registrations (category_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  round int not null,
  round_label text,
  slot int not null default 0,
  court int,
  scheduled_at timestamptz,
  reg_a uuid references public.registrations(id) on delete set null,
  reg_b uuid references public.registrations(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  sets jsonb not null default '[]'::jsonb,
  cur_a int not null default 0,
  cur_b int not null default 0,
  winner uuid references public.registrations(id) on delete set null,
  next_match uuid references public.matches(id) on delete set null,
  next_slot text check (next_slot in ('a', 'b')),
  updated_at timestamptz not null default now()
);
create index matches_tournament_idx on public.matches (tournament_id);
create index matches_category_idx on public.matches (category_id);
create index matches_reg_a_idx on public.matches (reg_a);
create index matches_reg_b_idx on public.matches (reg_b);
create index matches_winner_idx on public.matches (winner);
create index matches_next_idx on public.matches (next_match);

create table public.match_events (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  prev jsonb not null,
  created_at timestamptz not null default now()
);
create index match_events_match_idx on public.match_events (match_id, id desc);
create index match_events_tournament_idx on public.match_events (tournament_id);

-- at most 10 posters per tournament
create function public.limit_posters() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.tournament_posters where tournament_id = new.tournament_id) >= 10 then
    raise exception 'โปสเตอร์ได้ไม่เกิน 10 รูป';
  end if;
  return new;
end $$;
create trigger posters_limit before insert on public.tournament_posters
  for each row execute function public.limit_posters();

-- ---------------------------------------------------------------- helpers (used by RLS and storage policies)
create function public.owns_tournament(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tournaments x where x.id = t and x.organizer_id = (select auth.uid()))
$$;

create function public.tournament_visible(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tournaments x where x.id = t and x.status <> 'draft')
$$;

create function public.tournament_open(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tournaments x
    where x.id::text = t and x.status = 'open' and (x.reg_deadline is null or x.reg_deadline > now())
  )
$$;

create function public.reg_accepts_slip(r text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.registrations x
    where x.id::text = r and x.pay_status <> 'paid' and x.status in ('pending', 'confirmed')
  )
$$;

-- ---------------------------------------------------------------- row level security
alter table public.organizers enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_posters enable row level security;
alter table public.categories enable row level security;
alter table public.registrations enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;

create policy organizers_select on public.organizers for select to authenticated using (id = (select auth.uid()));
create policy organizers_insert on public.organizers for insert to authenticated with check (id = (select auth.uid()));
create policy organizers_update on public.organizers for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy tournaments_select on public.tournaments for select to anon, authenticated
  using (status <> 'draft' or organizer_id = (select auth.uid()));
create policy tournaments_insert on public.tournaments for insert to authenticated
  with check (organizer_id = (select auth.uid()));
create policy tournaments_update on public.tournaments for update to authenticated
  using (organizer_id = (select auth.uid())) with check (organizer_id = (select auth.uid()));
create policy tournaments_delete on public.tournaments for delete to authenticated
  using (organizer_id = (select auth.uid()));

create policy posters_select on public.tournament_posters for select to anon, authenticated
  using (public.tournament_visible(tournament_id) or public.owns_tournament(tournament_id));
create policy posters_insert on public.tournament_posters for insert to authenticated
  with check (public.owns_tournament(tournament_id));
create policy posters_update on public.tournament_posters for update to authenticated
  using (public.owns_tournament(tournament_id)) with check (public.owns_tournament(tournament_id));
create policy posters_delete on public.tournament_posters for delete to authenticated
  using (public.owns_tournament(tournament_id));

create policy categories_select on public.categories for select to anon, authenticated
  using (public.tournament_visible(tournament_id) or public.owns_tournament(tournament_id));
create policy categories_insert on public.categories for insert to authenticated
  with check (public.owns_tournament(tournament_id));
create policy categories_update on public.categories for update to authenticated
  using (public.owns_tournament(tournament_id)) with check (public.owns_tournament(tournament_id));
create policy categories_delete on public.categories for delete to authenticated
  using (public.owns_tournament(tournament_id));

-- registrations: no public access at all (phone numbers, slips). Public reads go through public_entries().
create policy registrations_select on public.registrations for select to authenticated
  using (public.owns_tournament(tournament_id));
create policy registrations_update on public.registrations for update to authenticated
  using (public.owns_tournament(tournament_id)) with check (public.owns_tournament(tournament_id));
create policy registrations_delete on public.registrations for delete to authenticated
  using (public.owns_tournament(tournament_id));

create policy matches_select on public.matches for select to anon, authenticated
  using (public.tournament_visible(tournament_id) or public.owns_tournament(tournament_id));
create policy matches_insert on public.matches for insert to authenticated
  with check (public.owns_tournament(tournament_id));
create policy matches_update on public.matches for update to authenticated
  using (public.owns_tournament(tournament_id)) with check (public.owns_tournament(tournament_id));
create policy matches_delete on public.matches for delete to authenticated
  using (public.owns_tournament(tournament_id));

create policy match_events_select on public.match_events for select to authenticated
  using (public.owns_tournament(tournament_id));

-- ---------------------------------------------------------------- public / registrant RPCs
-- Entry list for spectators: names, photos and status only.
create function public.public_entries(p_tournament uuid) returns table (
  id uuid, category_id uuid, status text,
  p1_name text, p1_nick text, p1_photo text,
  p2_name text, p2_nick text, p2_photo text,
  created_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.category_id, r.status, r.p1_name, r.p1_nick, r.p1_photo, r.p2_name, r.p2_nick, r.p2_photo, r.created_at
  from public.registrations r
  where r.tournament_id = p_tournament
    and r.status <> 'cancelled'
    and public.tournament_visible(p_tournament)
  order by r.created_at
$$;

create function public.register_team(
  p_tournament uuid, p_category uuid, p_p1 jsonb, p_p2 jsonb, p_video text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.categories;
  cnt int;
  st text;
  rid uuid;
  tok uuid;
  v text;
  n2 text;
  ph1 text; ph2 text;
begin
  if not public.tournament_open(p_tournament::text) then
    raise exception 'ปิดรับสมัครแล้ว';
  end if;
  select * into c from public.categories where id = p_category and tournament_id = p_tournament;
  if not found then raise exception 'ไม่พบประเภทที่เลือก'; end if;

  if coalesce(trim(p_p1 ->> 'name'), '') = '' then raise exception 'กรอกชื่อนักกีฬา'; end if;
  if coalesce(trim(p_p1 ->> 'phone'), '') = '' then raise exception 'กรอกเบอร์โทรของผู้สมัคร'; end if;
  n2 := nullif(trim(coalesce(p_p2 ->> 'name', '')), '');
  if c.kind = 'doubles' and n2 is null then raise exception 'ประเภทคู่ต้องกรอกชื่อคู่'; end if;

  v := nullif(trim(coalesce(p_video, '')), '');
  if v is not null and v !~* '^https?://' then raise exception 'ลิงก์วิดีโอต้องขึ้นต้นด้วย http หรือ https'; end if;

  ph1 := nullif(p_p1 ->> 'photo', '');
  ph2 := nullif(p_p2 ->> 'photo', '');
  if ph1 is not null and ph1 not like p_tournament::text || '/%' then raise exception 'รูปไม่ถูกต้อง'; end if;
  if ph2 is not null and ph2 not like p_tournament::text || '/%' then raise exception 'รูปไม่ถูกต้อง'; end if;

  perform pg_advisory_xact_lock(hashtext(p_category::text));
  select count(*) into cnt from public.registrations
    where category_id = p_category and status in ('pending', 'confirmed');
  st := case when cnt >= c.max_teams then 'waitlist' else 'pending' end;

  insert into public.registrations (
    tournament_id, category_id, status,
    p1_name, p1_nick, p1_phone, p1_birth_year, p1_photo,
    p2_name, p2_nick, p2_phone, p2_birth_year, p2_photo, video_url
  ) values (
    p_tournament, p_category, st,
    trim(p_p1 ->> 'name'), nullif(trim(coalesce(p_p1 ->> 'nick', '')), ''), trim(p_p1 ->> 'phone'),
    nullif(p_p1 ->> 'birth_year', '')::int, ph1,
    case when c.kind = 'doubles' then n2 end,
    case when c.kind = 'doubles' then nullif(trim(coalesce(p_p2 ->> 'nick', '')), '') end,
    case when c.kind = 'doubles' then nullif(trim(coalesce(p_p2 ->> 'phone', '')), '') end,
    case when c.kind = 'doubles' then nullif(p_p2 ->> 'birth_year', '')::int end,
    case when c.kind = 'doubles' then ph2 end,
    v
  ) returning id, edit_token into rid, tok;

  return jsonb_build_object('id', rid, 'token', tok, 'status', st);
end $$;

create function public.my_registration(p_reg uuid, p_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'pay_status', r.pay_status,
    'p1_name', r.p1_name,
    'p2_name', r.p2_name,
    'category', c.name,
    'fee', c.fee,
    'tournament_id', t.id,
    'tournament_name', t.name,
    'tournament_slug', t.slug,
    'promptpay_id', t.promptpay_id,
    'has_slip', r.slip_path is not null
  )
  from public.registrations r
  join public.categories c on c.id = r.category_id
  join public.tournaments t on t.id = r.tournament_id
  where r.id = p_reg and r.edit_token = p_token
$$;

create function public.submit_slip(p_reg uuid, p_token uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.registrations;
begin
  select * into r from public.registrations where id = p_reg and edit_token = p_token;
  if not found then raise exception 'ไม่พบรายการสมัคร'; end if;
  if r.status in ('waitlist', 'cancelled') then raise exception 'รายการนี้ยังชำระเงินไม่ได้'; end if;
  if r.pay_status = 'paid' then raise exception 'ชำระเงินแล้ว'; end if;
  if p_path not like r.tournament_id::text || '/' || r.id::text || '/%' then raise exception 'ไฟล์สลิปไม่ถูกต้อง'; end if;
  update public.registrations set slip_path = p_path, pay_status = 'slip_sent' where id = p_reg;
end $$;

-- ---------------------------------------------------------------- scoring RPCs (organizer only)
create function public.score_point(p_match uuid, p_side text) returns public.matches
language plpgsql security definer set search_path = '' as $$
declare
  m public.matches; t public.tournaments;
  pts int; cap int; bo int; need int;
  a int; b int; wa int; wb int;
begin
  if p_side not in ('a', 'b') then raise exception 'ฝั่งไม่ถูกต้อง'; end if;
  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'ไม่พบแมตช์'; end if;
  select * into t from public.tournaments where id = m.tournament_id;
  if t.organizer_id is distinct from (select auth.uid()) then raise exception 'ไม่มีสิทธิ์'; end if;
  if m.status = 'finished' then raise exception 'แมตช์นี้จบแล้ว'; end if;
  if m.reg_a is null or m.reg_b is null then raise exception 'คู่แข่งยังไม่ครบ'; end if;

  pts := coalesce((t.rules ->> 'points')::int, 21);
  cap := coalesce((t.rules ->> 'cap')::int, 30);
  bo := coalesce((t.rules ->> 'best_of')::int, 3);

  insert into public.match_events (match_id, tournament_id, side, prev) values (
    m.id, m.tournament_id, p_side,
    jsonb_build_object('cur_a', m.cur_a, 'cur_b', m.cur_b, 'sets', m.sets, 'status', m.status, 'winner', m.winner)
  );

  a := m.cur_a + case when p_side = 'a' then 1 else 0 end;
  b := m.cur_b + case when p_side = 'b' then 1 else 0 end;
  m.status := 'live';

  if (greatest(a, b) >= pts and abs(a - b) >= 2) or greatest(a, b) >= cap then
    m.sets := m.sets || jsonb_build_array(jsonb_build_array(a, b));
    a := 0; b := 0;
    select count(*) filter (where (e ->> 0)::int > (e ->> 1)::int),
           count(*) filter (where (e ->> 0)::int < (e ->> 1)::int)
      into wa, wb from jsonb_array_elements(m.sets) e;
    need := bo / 2 + 1;
    if wa >= need or wb >= need then
      m.status := 'finished';
      m.winner := case when wa >= need then m.reg_a else m.reg_b end;
    end if;
  end if;

  update public.matches
    set cur_a = a, cur_b = b, sets = m.sets, status = m.status, winner = m.winner, updated_at = now()
    where id = p_match returning * into m;

  if m.status = 'finished' and m.next_match is not null then
    if m.next_slot = 'a' then
      update public.matches set reg_a = m.winner, updated_at = now() where id = m.next_match;
    else
      update public.matches set reg_b = m.winner, updated_at = now() where id = m.next_match;
    end if;
  end if;
  return m;
end $$;

create function public.undo_point(p_match uuid) returns public.matches
language plpgsql security definer set search_path = '' as $$
declare
  m public.matches; t public.tournaments; ev public.match_events; nm public.matches;
begin
  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'ไม่พบแมตช์'; end if;
  select * into t from public.tournaments where id = m.tournament_id;
  if t.organizer_id is distinct from (select auth.uid()) then raise exception 'ไม่มีสิทธิ์'; end if;

  select * into ev from public.match_events where match_id = p_match order by id desc limit 1;
  if not found then raise exception 'ไม่มีแต้มให้ย้อน'; end if;

  if m.status = 'finished' and m.next_match is not null then
    select * into nm from public.matches where id = m.next_match;
    if nm.status <> 'scheduled' then raise exception 'รอบถัดไปเริ่มแข่งแล้ว ย้อนไม่ได้'; end if;
    if m.next_slot = 'a' then
      update public.matches set reg_a = null, updated_at = now() where id = m.next_match;
    else
      update public.matches set reg_b = null, updated_at = now() where id = m.next_match;
    end if;
  end if;

  update public.matches set
    cur_a = (ev.prev ->> 'cur_a')::int,
    cur_b = (ev.prev ->> 'cur_b')::int,
    sets = ev.prev -> 'sets',
    status = ev.prev ->> 'status',
    winner = (ev.prev ->> 'winner')::uuid,
    updated_at = now()
  where id = p_match returning * into m;

  delete from public.match_events where id = ev.id;
  return m;
end $$;

-- Bulk court/time assignment. Runs with the caller's rights, so RLS limits it to the organizer's own matches.
create function public.schedule_matches(p_tournament uuid, p_items jsonb) returns void
language sql set search_path = '' as $$
  update public.matches m
  set court = (i ->> 'court')::int, scheduled_at = (i ->> 'scheduled_at')::timestamptz, updated_at = now()
  from jsonb_array_elements(p_items) i
  where m.id = (i ->> 'id')::uuid and m.tournament_id = p_tournament
$$;
revoke execute on function public.schedule_matches(uuid, jsonb) from public, anon;
grant execute on function public.schedule_matches(uuid, jsonb) to authenticated;

-- Only signed-in organizers may call the scoring functions; anon may call the registrant ones.
revoke execute on function public.score_point(uuid, text) from public, anon;
revoke execute on function public.undo_point(uuid) from public, anon;
grant execute on function public.score_point(uuid, text) to authenticated;
grant execute on function public.undo_point(uuid) to authenticated;
revoke execute on function public.limit_posters() from public, anon, authenticated;

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.matches;

-- ---------------------------------------------------------------- storage
create function public.owns_tournament_txt(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tournaments x where x.id::text = t and x.organizer_id = (select auth.uid()))
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('posters', 'posters', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('photos', 'photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('slips', 'slips', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Folder layout: <tournament_id>/<file> (posters, photos) and <tournament_id>/<registration_id>/<file> (slips).
create policy posters_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and public.owns_tournament_txt((storage.foldername(name))[1]));
create policy posters_remove on storage.objects for delete to authenticated
  using (bucket_id = 'posters' and public.owns_tournament_txt((storage.foldername(name))[1]));

create policy photos_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'photos' and public.tournament_open((storage.foldername(name))[1]));
create policy photos_remove on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.owns_tournament_txt((storage.foldername(name))[1]));

create policy slips_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'slips' and public.reg_accepts_slip((storage.foldername(name))[2]));
create policy slips_read on storage.objects for select to authenticated
  using (bucket_id = 'slips' and public.owns_tournament_txt((storage.foldername(name))[1]));
create policy slips_remove on storage.objects for delete to authenticated
  using (bucket_id = 'slips' and public.owns_tournament_txt((storage.foldername(name))[1]));
