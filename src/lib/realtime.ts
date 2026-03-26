import { createClient } from '@supabase/supabase-js';

// מושך את הנתונים מקובץ ה-.env שיצרנו הרגע
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseRealtime = createClient(supabaseUrl, supabaseKey);

export function subscribeToMessages(circleId: string, onNewMessage: (payload: any) => void) {
  if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️ חסרים נתוני התחברות ל-Supabase עבור לייב צ׳אט');
    return () => {};
  }

  // התחברות לערוץ ספציפי של הקהילה
  const channel = supabaseRealtime
    .channel(`public:circle_messages:circle_id=eq.${circleId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'circle_messages',
        filter: `circle_id=eq.${circleId}`,
      },
      (payload) => {
        // כשנכנסת הודעה חדשה למסד הנתונים, אנחנו שולחים אותה מיד החוצה
        onNewMessage(payload.new);
      }
    )
    .subscribe();

  // פונקציית ניתוק כשהמשתמש יוצא מהעמוד
  return () => {
    supabaseRealtime.removeChannel(channel);
  };
}
