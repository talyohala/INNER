import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE as string;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('🚨 חסרים משתני סביבה בשרת: SUPABASE_URL או SUPABASE_SERVICE_ROLE');
}

export const supabase = createClient(supabaseUrl || '', supabaseServiceRole || '');
