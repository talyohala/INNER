import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Shield, FileText, Info, LogOut, ChevronLeft, Volume2, Vibrate,
  AlertTriangle, Accessibility, Trash2, UserCog, Link as LinkIcon, Ban,
  MessageSquare, Mail, Crown, EyeOff, Lock, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

type ActiveSheet =
  | 'linked' | 'blocked' | 'contact' | 'privacy' | 'terms' | 'accessibility'
  | 'about' | 'delete' | null;

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
      await navigator.clipboard.writeText('תמיכה@אינר.אפ');
      toast.success('כתובת התמיכה הועתקה');
      triggerFeedback('success');
    } catch {
      toast.error('לא הצלחתי להעתיק');
      triggerFeedback('error');
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
      case 'about':
        return (
          <div className="flex flex-col items-center justify-center text-center py-6 gap-5">
            <div className="w-24 h-24 bg-surface-card border border-white/10 rounded-[28px] flex items-center justify-center shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/20 to-transparent" />
                <Crown size={40} className="text-accent-primary drop-shadow-[0_0_15px_rgba(var(--color-accent-primary),0.5)] relative z-10" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-brand tracking-widest uppercase mb-1 italic">INNER</h2>
              <span className="text-brand-muted text-[11px] font-black uppercase tracking-[0.25em]">מהדורה אקסקלוסיבית 2026</span>
            </div>
            <p className="text-brand-muted text-[14px] leading-relaxed max-w-[320px] font-medium">
              אינר (INNER) נבנתה כדי להגדיר מחדש את המרחב החברתי הדיגיטלי. אנו מאמינים באיכות על פני כמות, ובקשרים אמיתיים המבוססים על מוניטין, השקעה וערך הדדי.
            </p>
          </div>
        );

      case 'blocked':
        return (
          <div className="flex flex-col gap-4 py-2">
            {loadingBlocked ? (
              <Loader2 className="animate-spin text-accent-primary mx-auto my-10" />
            ) : blockedUsers.length === 0 ? (
              <div className="text-center py-10 opacity-40">
                <Ban size={48} className="mx-auto mb-4 text-brand-muted" />
                <p className="text-sm font-bold">אין משתמשים חסומים</p>
              </div>
            ) : (
              blockedUsers.map(user => (
                <div key={user.blocked_id} className="flex items-center justify-between p-4 bg-surface-card border border-surface-border rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface overflow-hidden border border-surface-border">
                      {user.profiles?.avatar_url ? <img src={user.profiles.avatar_url} className="w-full h-full object-cover" /> : <User size={20} className="m-2.5 text-brand-muted" />}
                    </div>
                    <span className="font-bold text-brand">{user.profiles?.full_name || 'משתמש אינר'}</span>
                  </div>
                  <button onClick={() => unblockUser(user.blocked_id)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-black hover:bg-white/10 transition-colors">הסר חסימה</button>
                </div>
              ))
            )}
          </div>
        );

      case 'linked':
        return (
          <div className="flex flex-col gap-4 items-center text-center py-6">
            <div className="w-20 h-20 rounded-[28px] bg-white/5 border border-white/10 flex items-center justify-center">
              <LinkIcon size={32} className="text-brand" />
            </div>
            <h3 className="text-2xl font-black text-brand">שיטות התחברות</h3>
            <div className="w-full mt-4 flex flex-col gap-3">
               <div className="flex items-center justify-between p-4 bg-surface-card border border-surface-border rounded-2xl">
                  <div className="flex flex-col text-right">
                    <span className="text-sm font-black text-brand">כתובת אימייל</span>
                    <span className="text-xs text-brand-muted">{profile?.id ? 'מחובר ומאובטח' : ''}</span>
                  </div>
                  <Shield size={18} className="text-emerald-400" />
               </div>
               <p className="text-xs text-brand-muted pt-2">חיבורי צד-שלישי (גוגל ואפל) מנוהלים דרך הגדרות האבטחה של המכשיר שלך.</p>
            </div>
          </div>
        );

      case 'terms':
        return (
          <div className="flex flex-col gap-6 text-right py-2 text-brand-muted">
            <div className="flex justify-center mb-2"><Crown size={32} className="text-brand/20" /></div>
            <h3 className="text-2xl font-black text-brand text-center uppercase tracking-widest">תקנון ותנאי שימוש</h3>
            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black italic">1. הסכם משפטי מחייב</h4>
              <p className="text-[13px] leading-relaxed">
                ברוכים הבאים לאפליקציית INNER (להלן: "הפלטפורמה"). השימוש באפליקציה, לרבות כלל התכנים והשירותים המוצעים בה, מותנה בהסכמתך המלאה לתנאים המפורטים להלן. הגלישה והשימוש מהווים הסכמה חוזית מחייבת בינך לבין הנהלת הפלטפורמה.
              </p>
            </section>
            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black italic">2. כלכלת המערכת (CRD)</h4>
              <p className="text-[13px] leading-relaxed">
                כלל המטבעות הווירטואליים (CRD) הנרכשים או נצברים במערכת הינם נכס דיגיטלי לשימוש פנימי בלבד. אין להם ערך כספי בעולם האמיתי והם אינם ניתנים לפדיון או להמרה למטבעות פיאט. כל רכישה של חבילות מטבעות או מנויים הינה סופית ואינה ניתנת להחזר כספי.
              </p>
            </section>
            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black italic">3. אחריות על תוכן ומועדונים</h4>
              <p className="text-[13px] leading-relaxed">
                INNER משמשת כפלטפורמה לאירוח תוכן קהילתי. האחריות הבלעדית על תוכן המפורסם בפוסטים, בדרופים או במועדונים פרטיים חלה על המשתמש המפרסם. חל איסור מוחלט על פרסום תוכן המפר זכויות יוצרים, תוכן פוגעני או כזה המנוגד לחוקי מדינת ישראל.
              </p>
            </section>
            <div className="h-4" />
          </div>
        );

      case 'privacy':
        return (
          <div className="flex flex-col gap-6 text-right py-2 text-brand-muted">
            <div className="flex justify-center mb-2"><Shield size={32} className="text-accent-primary/50" /></div>
            <h3 className="text-2xl font-black text-brand text-center uppercase tracking-widest">מדיניות פרטיות</h3>
            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black italic">1. איסוף והגנה על מידע</h4>
              <p className="text-[13px] leading-relaxed">
                אנו אוספים מידע אישי בסיסי (אימייל, שם ושימוש במערכת) אך ורק לצורך תפעול ואבטחת החשבון שלך. המידע שלך אינו נמכר לגורמים שלישיים ואינו משמש לפרסום ממוקד מחוץ לפלטפורמה. כל המידע האישי והתוכן מאובטח בשרתים בסטנדרט הגבוה ביותר.
              </p>
            </section>
            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black italic">2. זכות המחיקה</h4>
              <p className="text-[13px] leading-relaxed">
                המשתמש שולט במידע שלו באופן מלא. בכל עת ניתן להפעיל את מנגנון מחיקת החשבון אשר יסיר את כלל הנתונים האישיים, היסטוריית הפעולות והארנק משרתי החברה ללא אפשרות שחזור.
              </p>
            </section>
            <div className="h-4" />
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
              <p className="text-brand-muted text-[14px] leading-relaxed px-4">
                מחיקת החשבון תביא להסרת ה-XP, ה-CRD, וכל התוכן שלך לצמיתות.
              </p>
            </div>
            <div className="w-full bg-surface-card border border-red-500/30 rounded-[28px] p-5 flex flex-col gap-4 shadow-inner">
              <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest">הקלד את הקוד כדי לאשר</span>
              <div className="text-2xl font-black text-red-400 tracking-[0.4em] select-none bg-surface py-3 rounded-[16px] border border-surface-border">{deleteCode}</div>
              <input type="text" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value.toUpperCase())} placeholder="הזן קוד..." dir="ltr" className="w-full h-14 bg-surface border border-surface-border rounded-[16px] text-center text-brand font-black text-lg tracking-widest outline-none" />
            </div>
            <Button onClick={handleDeleteAccount} disabled={isDeleting || deleteInput !== deleteCode} className="w-full h-14 bg-red-500 text-white font-black rounded-full flex items-center justify-center">
              {isDeleting ? <Loader2 className="animate-spin text-white" /> : 'מחק לצמיתות'}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <FadeIn className="px-4 pt-4 pb-[120px] flex flex-col gap-6 bg-surface min-h-screen font-sans relative" dir="rtl">
        <div className="flex items-center justify-center relative mb-4">
          <h1 className="text-lg font-black text-brand tracking-widest uppercase">הגדרות מערכת</h1>
        </div>

        <div className="flex flex-col gap-8 relative z-10">
          {SETTINGS_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-3">
              <h3 className="text-brand-muted text-[11px] font-black px-3 tracking-widest uppercase text-right">
                {group.title}
              </h3>
              <div className="bg-surface-card border border-surface-border rounded-[32px] overflow-hidden flex flex-col shadow-sm">
                {group.items.map((item: any, iIdx) => (
                  <button key={iIdx} onClick={() => (item.key ? toggleSetting(item.key) : item.action?.())} className={`flex items-center gap-4 p-4 text-right transition-all active:scale-[0.995] hover:bg-white/5 ${iIdx !== group.items.length - 1 ? 'border-b border-surface-border' : ''}`}>
                    <div className={`w-12 h-12 rounded-[20px] ${item.bg} border ${item.isDanger ? 'border-red-500/20' : 'border-white/5'} flex items-center justify-center shrink-0 shadow-inner`}>
                      <item.icon size={20} className={item.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-black text-[15px] ${item.isDanger ? 'text-red-500' : 'text-brand'}`}>{item.label}</div>
                      <div className="text-[11px] font-bold text-brand-muted mt-0.5 opacity-80 uppercase tracking-wide">{item.desc}</div>
                    </div>
                    {item.key ? (
                      <div className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${settings[item.key as keyof typeof settings] ? 'bg-accent-primary/20 border border-accent-primary/40' : 'bg-surface border border-surface-border'}`}>
                        <div className={`w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${settings[item.key as keyof typeof settings] ? 'bg-accent-primary translate-x-[-24px]' : 'bg-brand-muted translate-x-0'}`} />
                      </div>
                    ) : (
                      <ChevronLeft size={18} className="text-brand-muted" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 relative z-10">
          <Button onClick={async () => { triggerFeedback('pop'); await signOut(); navigate('/auth'); }} className="w-full h-14 bg-surface-card border border-surface-border text-brand font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2">
            <LogOut size={18} className="text-brand-muted" /> התנתקות
          </Button>
          <div className="text-center mt-6">
            <p className="text-[9px] font-black text-brand-muted/30 uppercase tracking-[0.4em]">אינר רשת חברתית אקסקלוסיבית © 2026</p>
          </div>
        </div>
      </FadeIn>

      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeSheet && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" dir="rtl">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeSheet} />
              <motion.div drag="y" dragConstraints={{ top: 0, bottom: 0 }} onDragEnd={(e, info) => { if (info.offset.y > 100) closeSheet(); }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className="relative z-10 bg-surface rounded-t-[40px] h-[85vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border">
                <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-surface-border"><div className="w-16 h-1.5 bg-white/10 rounded-full" /></div>
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">{renderSheetContent()}</div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
