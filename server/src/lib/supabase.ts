import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl) throw new Error('SUPABASE_URL is required');
if (!supabaseKey) throw new Error('SUPABASE_ANON_KEY is required');

export const supabase = createClient(supabaseUrl, supabaseKey);
