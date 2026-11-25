import React from 'react';
import { SUPABASE_URL, resizeImage, sb } from './supabase';

/** นักกีฬาตัวอย่าง (โมเดล) ของแต่ละรุ่น: ให้นักกีฬาดูเปรียบเทียบกับตัวเองก่อนเลือกรุ่น */
export interface AthleteModel {
  id: string;
  tournament_id: string;
  category_id: string | null;
  name: string;
  nick: string | null;
  photo: string | null;
  note: string | null;
  sort: number;
}

export async function listModels(tid: string): Promise<AthleteModel[]> {
  const { data, error } = await sb.from('athlete_models').select('*').eq('tournament_id', tid).order('sort').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []) as AthleteModel[];
}

export async function saveModel(m: Partial<AthleteModel> & { tournament_id: string; name: string }): Promise<void> {
  const row = { tournament_id: m.tournament_id, category_id: m.category_id || null, name: m.name.trim(), nick: m.nick?.trim() || null, photo: m.photo || null, note: m.note?.trim() || null, sort: m.sort ?? 0 };
  const q = m.id ? sb.from('athlete_models').update(row).eq('id', m.id) : sb.from('athlete_models').insert(row);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export async function deleteModel(id: string): Promise<void> {
  const { error } = await sb.from('athlete_models').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** อัปโหลดรูปโมเดล (bucket posters ซึ่งอ่านได้สาธารณะ) แล้วคืน URL เต็ม */
export async function uploadModelPhoto(tid: string, file: File): Promise<string> {
  const blob = await resizeImage(file, 640);
  const path = `${tid}/models/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from('posters').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return `${SUPABASE_URL}/storage/v1/object/public/posters/${path}`;
}

export function useModels(tid: string | undefined) {
  const [items, setItems] = React.useState<AthleteModel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const reload = React.useCallback(async () => {
    if (!tid) { setItems([]); setLoading(false); return; }
    try { setItems(await listModels(tid)); } catch { setItems([]); }
    setLoading(false);
  }, [tid]);
  React.useEffect(() => { setLoading(true); void reload(); }, [reload]);
  return { items, loading, reload };
}
