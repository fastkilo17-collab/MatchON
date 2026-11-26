import React from 'react';
import { SUPABASE_URL, resizeImage, sb } from './supabase';

/** ป้ายสปอนเซอร์ของรายการ: แสดงในแถบโฆษณาบนหน้าคะแนนสดจอใหญ่ */
export interface Sponsor {
  id: string;
  tournament_id: string;
  name: string;
  image: string | null;
  sort: number;
}

export async function listSponsors(tid: string): Promise<Sponsor[]> {
  const { data, error } = await sb.from('sponsors').select('*').eq('tournament_id', tid).order('sort').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []) as Sponsor[];
}

export async function saveSponsor(m: Partial<Sponsor> & { tournament_id: string; name: string }): Promise<void> {
  const row = { tournament_id: m.tournament_id, name: m.name.trim(), image: m.image || null, sort: m.sort ?? 0 };
  const q = m.id ? sb.from('sponsors').update(row).eq('id', m.id) : sb.from('sponsors').insert(row);
  const { error } = await q;
  if (error) throw new Error(error.message);
  window.dispatchEvent(new Event('matchon:sponsors'));
}

export async function deleteSponsor(id: string): Promise<void> {
  const { error } = await sb.from('sponsors').delete().eq('id', id);
  if (error) throw new Error(error.message);
  window.dispatchEvent(new Event('matchon:sponsors'));
}

export async function uploadSponsorImage(tid: string, file: File): Promise<string> {
  const blob = await resizeImage(file, 900);
  const path = `${tid}/sponsors/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from('posters').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return `${SUPABASE_URL}/storage/v1/object/public/posters/${path}`;
}

export function useSponsors(tid: string | undefined) {
  const [items, setItems] = React.useState<Sponsor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const reload = React.useCallback(async () => {
    if (!tid) { setItems([]); setLoading(false); return; }
    try { setItems(await listSponsors(tid)); } catch { setItems([]); }
    setLoading(false);
  }, [tid]);
  React.useEffect(() => { setLoading(true); void reload(); }, [reload]);
  return { items, loading, reload };
}
