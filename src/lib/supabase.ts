import { createClient } from '@supabase/supabase-js';

// Public project URL and anon key (safe to ship: row level security protects the data).
export const SUPABASE_URL = 'https://atjxzczutrenphivihyd.supabase.co';
export const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0anh6Y3p1dHJlbnBoaXZpaHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1NTM0OTgsImV4cCI6MjExMDEyOTQ5OH0.vQxAZo82FeCMfvnsyykwIbr7oeZTT1DZS_GeZ26PQCE';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const photoUrl = (path?: string | null): string =>
  path ? `${SUPABASE_URL}/storage/v1/object/public/photos/${path}` : '';

// Shrink a photo in the browser before upload (phones produce 5 MB+ images).
export async function resizeImage(file: File, maxSide = 800, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('แปลงรูปไม่สำเร็จ'))), 'image/jpeg', quality),
  );
}

export async function uploadPhoto(bucket: 'photos' | 'slips', folder: string, file: File): Promise<string> {
  const blob = await resizeImage(file, bucket === 'slips' ? 1400 : 800);
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}
