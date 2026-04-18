import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, Shield, FileText, Info, LogOut, ChevronLeft, Volume2, Vibrate, 
  AlertTriangle, Accessibility, Trash2, UserCog, Link as LinkIcon, Ban, 
  MessageSquare, Mail, Crown, EyeOff, Lock, User, Loader2, Zap, Globe, Key, UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

type ActiveSheet = 
  | 'linked' | 'blocked' | 'contact' | 'privacy' | 'terms' | 'accessibility' 
  | 'about' | 'delete' | 'password' | null;

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  
  const [mounted, setMounted] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteInput, setDeleteInput] = useState('');
  
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Password State
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' });

  const [settings, setSettings] = useState({
    push: localStorage.getItem('inner_push') !== 'false',
    sound: localStorage.getItem('inner_sound') !== 'false',
    haptic: localStorage.getItem('inner_haptic') !== 'false',
    ghostMode: localStorage.getItem('inner_ghost') === 'true',
    dmFilter: localStorage.getItem('inner_dm_filter') === 'true',
  });

  const stateRef = useRef({ sheet: false });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    stateRef.current = { sheet: !!activeSheet };
    if (activeSheet === 'blocked') fetchBlockedUsers();
    if (activeSheet === 'password') setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
  }, [activeSheet]);

  useEffect(() => {
    const handlePopState = () => {
      if (stateRef.current.sheet) setActiveSheet(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchBlockedUsers = async () => {
    setLoadingBlocked(true);
    try {
      const { data } = await supabase.from('blocked_users').select('blocked_id, profiles!blocked_id(*)');
      setBlockedUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const unblockUser = async (id: string) => {
    triggerFeedback('pop');
    try {
      await supabase.from('blocked_users').delete().eq('blocked_id', id);
      setBlockedUsers(prev => prev.filter(u => u.blocked_id !== id));
      toast.success('החסימה הוסרה');
    } catch (err) {
      toast.error('שגיאה בהסרת החסימה');
    }
  };

  const openSheet = (sheetName: Exclude<ActiveSheet, null>) => {
    triggerFeedback('pop');
    if (sheetName === 'delete') {
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      setDeleteCode(randomCode);
      setDeleteInput('');
    }
    window.history.pushState({ overlay: true }, '');
    setActiveSheet(sheetName);
  };

  const closeSheet = () => {
    if (activeSheet) {
      triggerFeedback('pop');
      window.history.back();
    }
  };

  const toggleSetting = (key: keyof typeof settings) => {
    const newValue = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    localStorage.setItem(`inner_${key}`, String(newValue));
    if (newValue) triggerFeedback('success');
    else triggerFeedback('pop');
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== deleteCode) {
      triggerFeedback('error');
      return toast.error('קוד האימות אינו תואם');
    }
    triggerFeedback('error');
    setIsDeleting(true);
    const tid = toast.loading('מוחק נתונים מהשרת...');
    try {
      await apiFetch('/api/account', { method: 'DELETE' });
      toast.success('החשבון נמחק לצמיתות. להתראות!', { id: tid });
      await signOut();
      navigate('/auth');
    } catch (err: any) {
      toast.error(err?.message || 'שגיאה במחיקת החשבון', { id: tid });
      setIsDeleting(false);
    }
  };

  const handleSupportMail = async () => {
    try {
      await navigator.clipboard.writeText('support@inner-app.com');
      toast.success('כתובת התמיכה הועתקה');
      triggerFeedback('success');
    } catch {
      toast.error('לא הצלחתי להעתיק');
      triggerFeedback('error');
    }
  };

  const handleUpdatePassword = async () => {
    if (updatingPassword) return;
    if (passwordData.new_password !== passwordData.confirm_password) { triggerFeedback('error'); toast.error('הסיסמאות לא תואמות'); return; }
    if (passwordData.new_password.length < 6) { triggerFeedback('error'); toast.error('הסיסמה קצרה מדי'); return; }
    
    setUpdatingPassword(true);
    triggerFeedback('pop');
    const tid = toast.loading('מעדכן סיסמה...');
    
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.new_password });
      if (error) throw error;
      
      toast.success('הסיסמה עודכנה בהצלחה!', { id: tid });
      closeSheet();
    } catch (err: any) {
      toast.error(`שגיאה: ${err.message}`, { id: tid });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const SETTINGS_GROUPS = [
    {
      title: 'חשבון',
      items: [
        {
          icon: UserCog, label: 'עריכת פרופיל', desc: 'שם, תמונה וביוגרפיה',
          action: () => { triggerFeedback('pop'); navigate('/edit-profile'); },
          color: 'text-accent-primary', bg: 'bg-accent-primary/10',
        },
        {
          icon: Key, label: 'שינוי סיסמה', desc: 'עדכון סיסמת התחברות',
          action: () => openSheet('password'),
          color: 'text-brand', bg: 'bg-white/5',
        },
        {
          icon: LinkIcon, label: 'שיטות התחברות', desc: 'ניהול גישה מאובטחת',
          action: () => openSheet('linked'),
          color: 'text-brand', bg: 'bg-white/5',
        },
      ],
    },
    {
      title: 'העדפות ופרטיות',
      items: [
        {
          icon: EyeOff, label: 'מצב רפאים', desc: 'גלישה ללא הצגת סטטוס מחובר',
          key: 'ghostMode', color: 'text-brand', bg: 'bg-white/5',
        },
        {
          icon: Shield, label: 'סינון הודעות קפדני', desc: 'רק חברים ומשתמשי ליבה יוכלו לפנות',
          key: 'dmFilter', color: 'text-brand', bg: 'bg-white/5',
        },
        {
          icon: Ban, label: 'רשימת חסומים', desc: 'ניהול המשתמשים שהרחקת',
          action: () => openSheet('blocked'), color: 'text-brand', bg: 'bg-white/5',
        }
      ],
    },
    {
      title: 'מערכת',
      items: [
        { icon: Bell, label: 'התראות פוש', desc: 'עדכונים בזמן אמת', key: 'push', color: 'text-brand', bg: 'bg-white/5' },
        { icon: Volume2, label: 'צלילי מערכת', desc: 'משוב קולי לפעולות', key: 'sound', color: 'text-brand', bg: 'bg-white/5' },
        { icon: Vibrate, label: 'תחושת מגע (רטט)', desc: 'פידבק פיזי באינטראקציות', key: 'haptic', color: 'text-brand', bg: 'bg-white/5' },
      ],
    },
    {
      title: 'מידע משפטי ותמיכה',
      items: [
        { icon: FileText, label: 'תנאי שימוש ותקנון', desc: 'ההסכם המשפטי המלא', action: () => openSheet('terms'), color: 'text-brand', bg: 'bg-white/5' },
        { icon: Lock, label: 'מדיניות פרטיות', desc: 'הגנה על המידע האישי שלך', action: () => openSheet('privacy'), color: 'text-brand', bg: 'bg-white/5' },
        { icon: Accessibility, label: 'הצהרת נגישות', desc: 'התאמות טכנולוגיות', action: () => openSheet('accessibility'), color: 'text-brand', bg: 'bg-white/5' },
        { icon: MessageSquare, label: 'יצירת קשר', desc: 'מענה אנושי לכל שאלה', action: () => openSheet('contact'), color: 'text-brand', bg: 'bg-white/5' },
        { icon: Info, label: 'אודות המערכת', desc: 'החזון שמאחורי הפלטפורמה', action: () => openSheet('about'), color: 'text-brand', bg: 'bg-white/5' },
      ],
    },
    {
      title: 'אזור רגיש',
      items: [
        { icon: Trash2, label: 'מחיקת חשבון', desc: 'הסרת כל הנתונים לצמיתות', action: () => openSheet('delete'), color: 'text-red-500', bg: 'bg-red-500/10', isDanger: true },
      ],
    },
  ];

  const renderSheetContent = () => {
    switch (activeSheet) {
      case 'password':
        return (
          <div className="flex flex-col gap-6 text-right py-4">
            <div className="flex justify-center mb-2"><Key size={36} className="text-accent-primary" /></div>
            <h3 className="text-2xl font-black text-brand text-center uppercase tracking-widest">שינוי סיסמה</h3>
            
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5 bg-surface-card border border-surface-border rounded-[24px] p-4 shadow-sm focus-within:border-accent-primary/50 transition-colors">
                <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-2">
                  <Shield size={14} className="text-accent-primary" /><span>סיסמה נוכחית</span>
                </label>
                <input type="password" value={passwordData.current_password} onChange={e => setPasswordData(p=>({...p, current_password: e.target.value}))} className="bg-transparent border-none outline-none text-brand text-[15px] font-bold placeholder:text-brand-muted/40 px-1" placeholder="••••••••" dir="ltr" style={{ colorScheme: 'dark' }} />
              </div>
              
              <div className="flex flex-col gap-1.5 bg-surface-card border border-surface-border rounded-[24px] p-4 shadow-sm focus-within:border-accent-primary/50 transition-colors">
                <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-2">
                  <Shield size={14} className="text-accent-primary" /><span>סיסמה חדשה</span>
                </label>
                <input type="password" value={passwordData.new_password} onChange={e => setPasswordData(p=>({...p, new_password: e.target.value}))} className="bg-transparent border-none outline-none text-brand text-[15px] font-bold placeholder:text-brand-muted/40 px-1" placeholder="••••••••" dir="ltr" style={{ colorScheme: 'dark' }} />
              </div>
              
              <div className="flex flex-col gap-1.5 bg-surface-card border border-surface-border rounded-[24px] p-4 shadow-sm focus-within:border-accent-primary/50 transition-colors">
                <label className="text-brand-muted text-[11px] font-black tracking-widest uppercase flex items-center gap-2">
                  <UserCheck size={14} className="text-accent-primary" /><span>אימות סיסמה חדשה</span>
                </label>
                <input type="password" value={passwordData.confirm_password} onChange={e => setPasswordData(p=>({...p, confirm_password: e.target.value}))} className="bg-transparent border-none outline-none text-brand text-[15px] font-bold placeholder:text-brand-muted/40 px-1" placeholder="••••••••" dir="ltr" style={{ colorScheme: 'dark' }} />
              </div>
            </div>

            <Button onClick={handleUpdatePassword} disabled={updatingPassword || !passwordData.new_password} className="w-full bg-accent-primary text-white rounded-[24px] font-black text-[14px] uppercase tracking-widest h-14 mt-4 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50">
              {updatingPassword ? <Loader2 size={20} className="animate-spin text-white" /> : 'עדכן סיסמה'}
            </Button>
          </div>
        );
      
      case 'about':
        return (
          <div className="flex flex-col items-center justify-center text-center py-6 gap-6">
            <div className="w-24 h-24 bg-surface-card border border-white/10 rounded-[32px] flex items-center justify-center shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/20 to-transparent" />
              <Crown size={40} className="text-accent-primary drop-shadow-[0_0_15px_rgba(var(--color-accent-primary),0.5)] relative z-10" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-brand tracking-widest uppercase mb-1 italic">INNER</h2>
              <span className="text-brand-muted text-[11px] font-black uppercase tracking-[0.25em]">Exclusive Network 2026</span>
            </div>
            <p className="text-brand-muted text-[15px] leading-relaxed max-w-[320px] font-medium">
              אינר (INNER) היא פלטפורמה חברתית אקסקלוסיבית שנועדה ליצור מרחב איכותי, נקי ובטוח לקהילות מובחרות. אנו שמים את המוניטין, הפרטיות והערך המוסף במרכז החוויה.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[280px]">
               <div className="flex justify-between items-center p-3 bg-surface-card rounded-[20px] border border-surface-border">
                 <span className="text-xs font-bold text-brand-muted uppercase tracking-widest">גרסת מערכת</span>
                 <span className="text-xs font-black text-brand tracking-wider">v1.0.4 Premium</span>
               </div>
               <div className="flex justify-between items-center p-3 bg-surface-card rounded-[20px] border border-surface-border">
                 <span className="text-xs font-bold text-brand-muted uppercase tracking-widest">שרתים</span>
                 <span className="text-xs font-black text-emerald-400 tracking-wider flex items-center gap-1.5">
                    פעיל ותקין <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                 </span>
               </div>
            </div>
          </div>
        );

      case 'blocked':
        return (
          <div className="flex flex-col gap-4 py-2">
            {loadingBlocked ? (
              <div className="flex flex-col items-center py-20 gap-3">
                 <Loader2 className="animate-spin text-accent-primary" size={32} />
                 <span className="text-xs font-bold text-brand-muted uppercase tracking-widest">טוען רשימה...</span>
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="text-center py-10 opacity-40">
                 <Ban size={48} className="mx-auto mb-4 text-brand-muted" />
                 <p className="text-sm font-bold uppercase tracking-widest">אין משתמשים חסומים</p>
              </div>
            ) : (
              blockedUsers.map(u => (
                <div key={u.blocked_id} className="flex items-center justify-between p-4 bg-surface-card border border-surface-border rounded-[24px] shadow-sm">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 rounded-full bg-surface overflow-hidden border border-surface-border flex items-center justify-center">
                       {u.profiles?.avatar_url ? <img src={u.profiles.avatar_url} className="w-full h-full object-cover" /> : <User size={24} className="text-brand-muted" />}
                     </div>
                     <div className="flex flex-col text-right">
                       <span className="font-black text-brand text-sm">{u.profiles?.full_name || 'משתמש אינר'}</span>
                       <span className="text-[10px] font-bold text-brand-muted" dir="ltr">@{u.profiles?.username}</span>
                     </div>
                  </div>
                  <button onClick={() => unblockUser(u.blocked_id)} className="px-5 py-2.5 bg-accent-primary/10 border border-accent-primary/30 rounded-[16px] text-[10px] font-black text-accent-primary hover:bg-accent-primary/20 transition-all uppercase tracking-widest">ביטול חסימה</button>
                </div>
              ))
            )}
          </div>
        );

      case 'linked':
        return (
          <div className="flex flex-col gap-6 items-center text-center py-6">
            <div className="w-20 h-20 rounded-[28px] bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
               <LinkIcon size={32} className="text-brand" />
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-brand uppercase tracking-tight">שיטות התחברות</h3>
              <p className="text-brand-muted text-xs font-medium">החשבון שלך מוגן ומקושר לאמצעים הבאים</p>
            </div>
            <div className="w-full flex flex-col gap-3">
               <div className="flex items-center justify-between p-5 bg-surface-card border border-surface-border rounded-[24px] shadow-sm">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center border border-surface-border"><Mail size={18} className="text-brand" /></div>
                    <div className="flex flex-col text-right">
                       <span className="text-sm font-black text-brand">כתובת אימייל</span>
                       <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">מאומת ומחובר <Zap size={10} fill="currentColor" /></span>
                    </div>
                 </div>
                 <div className="text-[10px] font-black text-brand-muted uppercase tracking-widest px-3 py-1 bg-white/5 rounded-[12px] border border-white/5">ראשי</div>
               </div>
               <p className="text-[11px] text-brand-muted leading-relaxed px-4 text-center font-medium mt-2">
                 שינוי אמצעי התחברות או חיבור חשבונות חברתיים נוספים (גוגל/אפל) מתבצע דרך עריכת הפרופיל והגדרות האבטחה של המכשיר.
               </p>
            </div>
          </div>
        );

      case 'terms':
        return (
          <div className="flex flex-col gap-6 text-right py-4 text-brand-muted">
            <div className="flex justify-center mb-2"><Crown size={32} className="text-brand/20" /></div>
            <h3 className="text-2xl font-black text-brand text-center uppercase tracking-widest">תקנון ותנאי שימוש</h3>
            <div className="space-y-6">
              <section className="space-y-2">
                <h4 className="text-brand font-black text-sm uppercase tracking-widest border-r-2 border-accent-primary pr-2 italic">1. מבוא והסכמה לתנאים</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  השימוש באפליקציית INNER (להלן: "האפליקציה"), לרבות כלל התכנים, הכלכלה הווירטואלית, הדרופים והמועדונים, כפוף להסכמתך המלאה לתנאים אלו. בעצם ההרשמה, הנך מצהיר כי קראת, הבנת והסכמת לתקנון.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="text-brand font-black text-sm uppercase tracking-widest border-r-2 border-accent-primary pr-2 italic">2. הכלכלה הפנימית (CRD)</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  2.1 המטבעות הווירטואליים (להלן: "CRD") משמשים לצורך אינטראקציות בתוך הפלטפורמה בלבד.<br/>
                  2.2 המטבעות אינם הילך חוקי, אינם ניתנים להמרה למטבע פיאט (כסף אמיתי) ואין להם שום ערך מחוץ לאפליקציה.<br/>
                  2.3 רכישת CRD או שירותי מנוי היא סופית. לא יינתנו החזרים כספיים מכל סיבה שהיא, למעט מקרים המוגדרים בחוק הגנת הצרכן הישראלי.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="text-brand font-black text-sm uppercase tracking-widest border-r-2 border-accent-primary pr-2 italic">3. התנהגות משתמשים וקניין רוחני</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  כל משתמש נושא באחריות פלילית ואזרחית מלאה על התוכן שהוא מעלה. חל איסור מוחלט על פרסום תוכן המפר זכויות יוצרים, תוכן פורנוגרפי, או כזה המעודד אלימות או גזענות. הפלטפורמה רשאית למחוק חשבונות שיפרו תנאים אלו ללא התראה וללא החזר יתרה.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="text-brand font-black text-sm uppercase tracking-widest border-r-2 border-accent-primary pr-2 italic">4. סמכות שיפוט</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  הדין החל על שימוש זה הוא הדין הישראלי בלבד. סמכות השיפוט הבלעדית בכל הנוגע לפלטפורמה מסורה לבתי המשפט המוסמכים במחוז תל אביב-יפו.
                </p>
              </section>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="flex flex-col gap-6 text-right py-4 text-brand-muted">
            <div className="flex justify-center mb-2"><Shield size={32} className="text-accent-primary/50" /></div>
            <h3 className="text-2xl font-black text-brand text-center uppercase tracking-widest">מדיניות פרטיות</h3>
            <div className="space-y-6">
              <section className="space-y-2">
                <h4 className="text-brand font-black text-sm uppercase tracking-widest border-r-2 border-emerald-400 pr-2 italic">1. איסוף המידע</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  אנו אוספים מידע הנמסר על ידך (שם, אימייל) ומידע טכני בסיסי הנדרש לתפעול האפליקציה. אנו משתמשים בטכנולוגיות הצפנה מתקדמות כדי להבטיח שהמידע האישי שלך יישאר בטוח.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="text-brand font-black text-sm uppercase tracking-widest border-r-2 border-emerald-400 pr-2 italic">2. שימוש בצדדים שלישיים</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  INNER אינה מוכרת, משכירה או סוחרת במידע האישי שלך עם חברות פרסום. השימוש במידע נעשה אך ורק לצורך שיפור החוויה, מניעת הונאות ואבטחת הכלכלה הפנימית.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="text-brand font-black text-sm uppercase tracking-widest border-r-2 border-emerald-400 pr-2 italic">3. זכות הגישה והמחיקה</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  לכל משתמש עומדת הזכות לעיין במידע שלו ולבצע מחיקה מוחלטת של חשבונו. פעולת המחיקה מסירה את כל הנתונים משרתינו לצמיתות ולא ניתן לשחזרם.
                </p>
              </section>
            </div>
          </div>
        );

      case 'accessibility':
        return (
          <div className="flex flex-col gap-6 text-right py-4 text-brand-muted">
            <div className="flex justify-center mb-2"><Accessibility size={32} className="text-blue-400" /></div>
            <h3 className="text-2xl font-black text-brand text-center uppercase tracking-widest">הצהרת נגישות</h3>
            <div className="space-y-6 font-medium">
              <p className="text-[13px] leading-relaxed">
                חברת INNER משקיעה מאמצים רבים להנגיש את השירותים הדיגיטליים שלה לכלל האוכלוסייה, לרבות אנשים עם מוגבלות, מתוך אמונה בשוויון הזדמנויות ובכבוד האדם.
              </p>
              <div className="p-5 bg-surface-card rounded-[24px] border border-surface-border space-y-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <Globe size={18} className="text-accent-primary" />
                  <span className="text-sm font-black text-brand uppercase tracking-widest">התאמות שבוצעו:</span>
                </div>
                <ul className="text-[12px] list-disc list-inside space-y-2 text-brand">
                  <li>תאימות מלאה לקוראי מסך במובייל (iOS/Android).</li>
                  <li>ניווט פשוט ואינטואיטיבי המבוסס על מחוות יד סטנדרטיות.</li>
                  <li>שימוש בניגודיות צבעים גבוהה וגופנים קריאים.</li>
                  <li>אזורי לחיצה מוגדלים למניעת לחיצות שגויות.</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'delete':
        return (
          <div className="flex flex-col items-center justify-center text-center gap-6 py-2">
            <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <AlertTriangle size={36} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-brand mb-2">אזהרת מחיקה</h3>
              <p className="text-brand-muted text-[14px] leading-relaxed px-4 font-medium">
                מחיקת החשבון תביא להסרת ה-XP, ה-CRD, המועדונים וכל התוכן שלך <strong className="text-red-500 underline uppercase tracking-widest">לצמיתות</strong> משרתי אינר.
              </p>
            </div>
            <div className="w-full bg-surface-card border border-red-500/30 rounded-[32px] p-6 flex flex-col gap-4 shadow-inner">
              <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest">הקלד את קוד הביטחון כדי לאשר</span>
              <div className="text-3xl font-black text-red-400 tracking-[0.4em] select-none bg-surface py-4 rounded-[20px] border border-surface-border">{deleteCode}</div>
              <input type="text" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value.toUpperCase())} placeholder="הזן קוד..." dir="ltr" className="w-full h-14 bg-surface border border-surface-border rounded-[20px] text-center text-brand font-black text-lg tracking-widest outline-none focus:border-red-500 transition-all" />
            </div>
            <Button onClick={handleDeleteAccount} disabled={isDeleting || deleteInput !== deleteCode} className="w-full h-14 bg-red-500 text-white font-black rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all">
              {isDeleting ? <Loader2 className="animate-spin text-white" /> : 'מחק חשבון ונתונים'}
            </Button>
          </div>
        );

      case 'contact':
        return (
          <div className="flex flex-col gap-5 items-center text-center py-6">
            <div className="w-20 h-20 rounded-[28px] bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shadow-inner">
              <Mail size={32} className="text-accent-primary" />
            </div>
            <h3 className="text-2xl font-black text-brand uppercase tracking-tighter">צוות התמיכה</h3>
            <p className="text-brand-muted text-[15px] leading-relaxed max-w-[320px] font-medium">
              יש לך שאלה? נתקלת בתקלה טכנית? צוות הניהול של אינר זמין עבורך במייל. נחזור אליך בתוך פחות מ-24 שעות.
            </p>
            <Button onClick={handleSupportMail} className="mt-4 w-full h-14 bg-white text-black font-black uppercase tracking-widest rounded-full shadow-[0_5px_20px_rgba(255,255,255,0.15)] active:scale-95 transition-transform">
              העתק כתובת תמיכה
            </Button>
            <span className="text-[10px] font-bold text-brand-muted mt-2">support@inner-app.com</span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* 📄 MAIN SETTINGS PAGE */}
      <FadeIn className="px-4 pt-6 pb-[120px] flex flex-col gap-6 bg-surface min-h-screen font-sans relative" dir="rtl">
        
        {/* HEADER */}
        <div className="flex items-center justify-center relative mb-2">
          <h1 className="text-lg font-black text-brand tracking-widest uppercase italic">הגדרות מערכת</h1>
        </div>

        <div className="flex flex-col gap-8 relative z-10">
          {SETTINGS_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-3">
              <h3 className="text-brand-muted text-[10px] font-black px-3 tracking-widest uppercase text-right opacity-60">
                {group.title}
              </h3>
              
              <div className="flex flex-col gap-2">
                {group.items.map((item: any, iIdx) => (
                  <button
                    key={iIdx}
                    onClick={() => (item.key ? toggleSetting(item.key) : item.action?.())}
                    className={`flex items-center gap-4 p-4 text-right transition-all active:scale-[0.98] bg-surface-card border border-surface-border rounded-[24px] shadow-sm hover:border-accent-primary/30`}
                  >
                    <div className={`w-12 h-12 rounded-[20px] ${item.bg} border ${item.isDanger ? 'border-red-500/20' : 'border-white/5'} flex items-center justify-center shrink-0 shadow-inner`}>
                      <item.icon size={20} className={item.color} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className={`font-black text-[15px] ${item.isDanger ? 'text-red-500' : 'text-brand'}`}>
                        {item.label}
                      </div>
                      <div className="text-[11px] font-bold text-brand-muted mt-0.5 uppercase tracking-wide opacity-80">
                        {item.desc}
                      </div>
                    </div>
                    
                    {item.key ? (
                      <div className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${settings[item.key as keyof typeof settings] ? 'bg-accent-primary/20 border border-accent-primary/40' : 'bg-surface border border-surface-border'}`}>
                        <div className={`w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${settings[item.key as keyof typeof settings] ? 'bg-accent-primary translate-x-[-24px]' : 'bg-brand-muted translate-x-0'}`} />
                      </div>
                    ) : (
                      <ChevronLeft size={18} className={`${item.isDanger ? 'text-red-400' : 'text-brand-muted'} transition-colors opacity-50`} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Logout Button */}
        <div className="mt-4 relative z-10">
          <Button
            onClick={async () => {
              triggerFeedback('pop');
              await signOut();
              navigate('/auth');
            }}
            className="w-full h-14 bg-surface-card border border-surface-border text-brand font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 shadow-sm hover:border-accent-primary/30 transition-all active:scale-[0.98]"
          >
            <LogOut size={18} className="text-brand-muted" />
            התנתקות מהמערכת
          </Button>
          
          <div className="text-center mt-6">
            <p className="text-[9px] font-black text-brand-muted/30 uppercase tracking-[0.4em]">אינר רשת חברתית אקסקלוסיבית © 2026</p>
          </div>
        </div>
      </FadeIn>

      {/* 📱 BOTTOM SHEETS */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeSheet && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" dir="rtl" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={closeSheet} />
              
              <motion.div 
                drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.22} 
                onDragEnd={(e, info) => { if (info.offset.y > 100 || info.velocity.y > 500) closeSheet(); }}
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                className="relative z-10 bg-surface rounded-t-[40px] max-h-[90vh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,20px)] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border"
              >
                <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border">
                  <div className="w-16 h-1.5 bg-white/10 rounded-full" />
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide overscroll-none" onPointerDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                  {renderSheetContent()}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
