import { supabase } from './supabase';

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadToBucket(bucket: 'avatars' | 'covers' | 'drops', file: File, userId: string) {
  const ext = file.name.split('.').pop() || 'bin';
  const fileName = `${userId}/${Date.now()}-${sanitizeFileName(file.name || `file.${ext}`)}`;

  const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
    upsert: true,
    cacheControl: '3600'
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}
