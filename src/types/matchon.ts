export type UserRole = 'organizer' | 'player' | 'referee';

export type TournamentStatus = 'open' | 'live' | 'closed' | 'draft';
export type CategoryKind = 'singles' | 'doubles';
export type CategoryGender = 'male' | 'female' | 'mixed' | 'open';
export type BracketFormat = 'knockout' | 'round_robin' | 'group_stage' | 'group_knockout' | 'swiss';
export type RegStatus = 'pending' | 'confirmed' | 'waitlist' | 'rejected' | 'cancelled';
export type PayStatus = 'unpaid' | 'slip_sent' | 'paid' | 'rejected';
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type MatchStage = 'main' | 'group' | 'knockout' | 'swiss';
export type CourtStatus = 'available' | 'maintenance';

export type NavRoute =
  | 'dashboard'
  | 'tournaments'
  | 'register'
  | 'my'
  | 'athletes'
  | 'brackets'
  | 'schedule'
  | 'courts'
  | 'live'
  | 'rules'
  | 'staff'
  | 'results'
  | 'reports'
  | 'settings'
  | 'home'
  | 'mine'
  | 'cats'
  | 'info'
  | 'roster'
  | 'admin';

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  venue: string;
  description: string;
  start_date: string;
  end_date: string;
  reg_deadline: string;
  courts: number;
  status: TournamentStatus;
  promptpay_id: string;
  match_minutes: number;
  rest_minutes: number;
  organizer_id?: string;
  live_id?: string | null;
  poster?: string | null;
  format_text?: string;
  rules_text?: string;
  notice?: string;
}

export interface Category {
  id: string;
  tournament_id: string;
  name: string;
  kind: CategoryKind;
  gender: CategoryGender;
  level: string | null;
  age_min: number | null;
  age_max: number | null;
  max_teams: number;
  fee: number;
  shuttle_fee?: number;
  shuttle_qty?: number;
  format: BracketFormat;
  best_of: number;
  points: number;
  cap: number;
  deuce: boolean;
  play_two?: boolean;
  rule_group?: string | null;
  rule_ko?: string | null;
}

export interface Registration {
  id: string;
  tournament_id: string;
  category_id: string;
  club: string;
  p1_name: string;
  p1_nick: string;
  p1_phone: string;
  p1_year?: number | null;
  p1_photo?: string | null;
  p2_name?: string;
  p2_nick?: string;
  p2_phone?: string;
  p2_year?: number | null;
  p2_photo?: string | null;
  edit_token?: string;
  reg_open?: boolean;
  status: RegStatus;
  pay_status: PayStatus;
  note?: string;
  seed: number | null;
  is_mine?: boolean;
  slip_path?: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  category_id: string;
  match_no: number | null;
  round: number;
  round_label: string;
  slot: number;
  stage: MatchStage;
  group_no?: number;
  reg_a: string | null;
  reg_b: string | null;
  status: MatchStatus;
  court: number | null;
  scheduled_at: string | null;
  sets: [number, number][];
  cur_a: number;
  cur_b: number;
  winner: string | null;
  next_match: string | null;
  next_slot: 'a' | 'b' | null;
  updated_at: string;
}

export interface Court {
  id: string;
  tournament_id: string;
  no: number;
  name: string;
  status: CourtStatus;
}

export interface BracketMeta {
  tournament_id: string;
  category_id: string;
  format: BracketFormat;
  groups: number;
  advance: number;
  seeded: boolean;
  locked: boolean;
}

export interface RulePreset {
  id: string;
  tournament_id: string;
  name: string;
  best_of: number;
  points: number;
  deuce: boolean;
  cap: number;
  play_two?: boolean;
  win_pts?: number;
  draw_pts?: number;
  loss_pts?: number;
}

export interface Referee {
  id: string;
  tournament_id: string;
  name: string;
  phone: string;
  court_no: number | null;
}

export interface NotificationItem {
  id: string;
  tournament_id: string;
  registration_id: string;
  kind: 'schedule' | 'approval' | 'payment' | 'result';
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

export interface MatchONState {
  role: UserRole;
  activeTid: string;
  tournaments: Tournament[];
  categories: Category[];
  registrations: Registration[];
  matches: Match[];
  courts: Court[];
  brackets: BracketMeta[];
  rules: RulePreset[];
  referees: Referee[];
  notifications: NotificationItem[];
}
