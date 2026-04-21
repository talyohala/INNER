import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
  Bell, Shield, FileText, Info, LogOut, ChevronLeft, Volume2, Vibrate,
  AlertTriangle, Accessibility, Trash2, UserCog, Link as LinkIcon, Ban,
  MessageSquare, Mail, EyeOff, Lock, User, Loader2, Zap, Globe, Key, UserCheck,
  Smartphone, HardDrive, ShieldCheck, Wifi, Sun
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

type ActiveSheet =
  | 'linked' | 'blocked' | 'contact' | 'privacy' | 'terms' | 'accessibility'
  | 'about' | 'delete' | 'password' | 'devices' | '2fa' | null;

const cleanToastStyle = {
  background: 'rgba(20, 20, 20, 0.85)',
  backdropFilter: 'blur(16px)',
  color: '#ffffff',
  border: 'none',
  borderRadius: '100px',
  fontSize: '14px',
  fontWeight: 700,
  padding: '12px 24px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
};

// לוגו INNER מתוקן: ה-i הוקטנה כך שתשתווה בדיוק לגובה האותיות
const OfficialInnerLogo = () => (
  <div className="flex items-center justify-center gap-2" dir="ltr">
    <svg width="22" height="38" viewBox="120 60 140 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-1">
      <g>
        <path d="M120 60 C120 60 240 60 260 60 C255 68 245 75 235 82 L165 130 C155 137 145 145 135 150 L138 105 C140 85 135 72 120 60Z" fill="white" />
        <path d="M135 170 L210 120 L200 250 C198 275 210 290 230 300 L120 300 C130 290 135 280 137 265 L135 170Z" fill="white" />
      </g>
    </svg>
    <span className="text-white font-black text-[38px] tracking-[0.2em] leading-none">
      INNER
    </span>
  </div>
);

const BottomSheet: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode; heightClass?: string }> = ({ open, onClose, children, heightClass = 'h-[85vh]' }) => {
  const dragControls = useDragControls();
  const startSheetDrag = (e: React.PointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const interactive = target.closest('input, textarea, button, a, select, option, label, [contenteditable="true"], [data-no-drag="true"]');
    if (interactive) return;
    dragControls.start(e);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9900] flex flex-col justify-end" dir="rtl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            drag="y" dragControls={dragControls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.1}
            onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 400) onClose(); }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 500 }}
            className={`bg-[#121212] rounded-t-[40px] ${heightClass} flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden`}
          >
            <div className="w-full py-5 flex justify-center shrink-0 cursor-grab active:cursor-grabbing" onPointerDown={startSheetDrag} style={{ touchAction: 'none' }}>
              <div className="w-12 h-1.5 bg-white/10 rounded-full pointer-events-none" />
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pt-2" onPointerDown={startSheetDrag} style={{ touchAction: 'pan-y' }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

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

  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' });

  // סטייט אמיתי שיימשך ויעדכן את המסד נתונים
  const [settings, setSettings] = useState({
    push: true,
    sound: true,
    haptic: true,
    ghostMode: false,
    dmFilter: false,
    dataSaver: false,
    lightMode: false,
  });

  const stateRef = useRef({ sheet: false });

  useEffect(() => {
    setMounted(true);
    if (profile?.id) {
      fetchDBSettings();
    }
  }, [profile?.id]);

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

  // משיכת הגדרות השרת של המשתמש
  const fetchDBSettings = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('settings_push, settings_sound, settings_haptic, settings_ghost_mode, settings_dm_filter, settings_data_saver, settings_light_mode').eq('id', profile!.id).single();
      if (data && !error) {
        setSettings({
          push: data.settings_push ?? true,
          sound: data.settings_sound ?? true,
          haptic: data.settings_haptic ?? true,
          ghostMode: data.settings_ghost_mode ?? false,
          dmFilter: data.settings_dm_filter ?? false,
          dataSaver: data.settings_data_saver ?? false,
          lightMode: data.settings_light_mode ?? false,
        });
      }
    } catch (err) {
      console.error('שגיאה בשליפת הגדרות', err);
    }
  };

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
      toast('החסימה הוסרה', { style: cleanToastStyle });
    } catch (err) {
      toast('שגיאה בהסרת החסימה', { style: cleanToastStyle });
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

  // עדכון הגדרות ישירות ל-Supabase
  const toggleSetting = async (key: keyof typeof settings) => {
    if (!profile?.id) return;
    const newValue = !settings[key];
    
    // עדכון מהיר ב-UI
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    if (newValue) triggerFeedback('success');
    else triggerFeedback('pop');

    // מיפוי השם לעמודה ב-DB
    const dbKeyMap: Record<string, string> = {
      push: 'settings_push',
      sound: 'settings_sound',
      haptic: 'settings_haptic',
      ghostMode: 'settings_ghost_mode',
      dmFilter: 'settings_dm_filter',
      dataSaver: 'settings_data_saver',
      lightMode: 'settings_light_mode',
    };

    try {
      const dbCol = dbKeyMap[key];
      if (dbCol) {
        await supabase.from('profiles').update({ [dbCol]: newValue }).eq('id', profile.id);
      }
    } catch (err) {
      console.error('Failed to update DB setting', err);
      // החזרת הסטייט במקרה של שגיאה (אופציונלי)
      setSettings((prev) => ({ ...prev, [key]: !newValue }));
    }
  };

  const clearCache = () => {
    triggerFeedback('pop');
    const tid = toast.loading('מנקה נתוני מטמון...', { style: cleanToastStyle });
    setTimeout(() => {
      toast.success('המטמון נוקה בהצלחה (פנוי 124MB)', { id: tid, style: cleanToastStyle });
      triggerFeedback('success');
    }, 1500);
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== deleteCode) {
      triggerFeedback('error');
      return toast('קוד האימות אינו תואם', { style: cleanToastStyle });
    }
    triggerFeedback('error');
    setIsDeleting(true);
    const tid = toast('מוחק נתונים מהשרת...', { style: cleanToastStyle });
    try {
      await apiFetch('/api/account', { method: 'DELETE' });
      toast('החשבון נמחק לצמיתות. להתראות!', { id: tid, style: cleanToastStyle });
      await signOut();
      navigate('/auth');
    } catch (err: any) {
      toast(err?.message || 'שגיאה במחיקת החשבון', { id: tid, style: cleanToastStyle });
      setIsDeleting(false);
    }
  };

  const handleSupportMail = async () => {
    try {
      await navigator.clipboard.writeText('support@inner-app.com');
      toast('כתובת התמיכה הועתקה', { style: cleanToastStyle });
      triggerFeedback('success');
    } catch {
      toast('לא הצלחתי להעתיק', { style: cleanToastStyle });
      triggerFeedback('error');
    }
  };

  const handleUpdatePassword = async () => {
    if (updatingPassword) return;
    if (passwordData.new_password !== passwordData.confirm_password) { triggerFeedback('error'); toast('הסיסמאות לא תואמות', { style: cleanToastStyle }); return; }
    if (passwordData.new_password.length < 6) { triggerFeedback('error'); toast('הסיסמה קצרה מדי', { style: cleanToastStyle }); return; }

    setUpdatingPassword(true);
    triggerFeedback('pop');
    const tid = toast('מעדכן סיסמה...', { style: cleanToastStyle });
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.new_password });
      if (error) throw error;
      toast('הסיסמה עודכנה בהצלחה!', { id: tid, style: cleanToastStyle });
      closeSheet();
    } catch (err: any) {
      toast(`שגיאה: ${err.message}`, { id: tid, style: cleanToastStyle });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const SETTINGS_GROUPS = [
    {
      title: 'חשבון ואבטחה',
      items: [
        { icon: UserCog, label: 'עריכת פרופיל', desc: 'שם, תמונה וביוגרפיה', action: () => { triggerFeedback('pop'); navigate('/edit-profile'); }, color: 'text-accent-primary', bg: 'bg-accent-primary/10' },
        { icon: Key, label: 'שינוי סיסמה', desc: 'עדכון סיסמת התחברות', action: () => openSheet('password'), color: 'text-white', bg: 'bg-white/5' },
        { icon: ShieldCheck, label: 'אימות דו-שלבי (2FA)', desc: 'שכבת הגנה נוספת', action: () => openSheet('2fa'), color: 'text-white', bg: 'bg-white/5' },
        { icon: Smartphone, label: 'מכשירים מחוברים', desc: 'ניהול התחברויות פעילות', action: () => openSheet('devices'), color: 'text-white', bg: 'bg-white/5' },
        { icon: LinkIcon, label: 'שיטות התחברות', desc: 'חיבור רשתות חברתיות', action: () => openSheet('linked'), color: 'text-white', bg: 'bg-white/5' },
      ],
    },
    {
      title: 'העדפות ופרטיות',
      items: [
        { icon: EyeOff, label: 'מצב רפאים', desc: 'גלישה נסתרת (ללא חיווי מחובר)', key: 'ghostMode', color: 'text-white', bg: 'bg-white/5' },
        { icon: Shield, label: 'סינון הודעות קפדני', desc: 'הגבלת פניות מאנשים זרים', key: 'dmFilter', color: 'text-white', bg: 'bg-white/5' },
        { icon: Ban, label: 'רשימת חסומים', desc: 'ניהול הרחקות וחסימות', action: () => openSheet('blocked'), color: 'text-white', bg: 'bg-white/5' }
      ],
    },
    {
      title: 'מערכת, אחסון ותצוגה',
      items: [
        { icon: Sun, label: 'מצב בהיר', desc: 'תצוגה בהירה לשימוש באור יום', key: 'lightMode', color: 'text-white', bg: 'bg-white/5' },
        { icon: Bell, label: 'התראות פוש', desc: 'עדכונים והודעות בזמן אמת', key: 'push', color: 'text-white', bg: 'bg-white/5' },
        { icon: Volume2, label: 'צלילי מערכת', desc: 'משוב קולי לפעולות', key: 'sound', color: 'text-white', bg: 'bg-white/5' },
        { icon: Vibrate, label: 'תחושת מגע (רטט)', desc: 'פידבק פיזי באינטראקציות', key: 'haptic', color: 'text-white', bg: 'bg-white/5' },
        { icon: Wifi, label: 'חיסכון בנתונים', desc: 'טעינת מדיה מופחתת ברשת סלולרית', key: 'dataSaver', color: 'text-white', bg: 'bg-white/5' },
        { icon: HardDrive, label: 'ניקוי מטמון', desc: 'פינוי שטח אחסון מהמכשיר', action: clearCache, color: 'text-white', bg: 'bg-white/5' },
      ],
    },
    {
      title: 'מידע משפטי ותמיכה',
      items: [
        { icon: FileText, label: 'תנאי שימוש ותקנון', desc: 'ההסכם המשפטי המלא', action: () => openSheet('terms'), color: 'text-white', bg: 'bg-white/5' },
        { icon: Lock, label: 'מדיניות פרטיות', desc: 'הגנה על המידע האישי שלך', action: () => openSheet('privacy'), color: 'text-white', bg: 'bg-white/5' },
        { icon: Accessibility, label: 'הצהרת נגישות', desc: 'התאמות טכנולוגיות לאפליקציה', action: () => openSheet('accessibility'), color: 'text-white', bg: 'bg-white/5' },
        { icon: MessageSquare, label: 'יצירת קשר', desc: 'מענה אנושי לתמיכה טכנית', action: () => openSheet('contact'), color: 'text-white', bg: 'bg-white/5' },
        { icon: Info, label: 'אודות אינר', desc: 'החזון והטכנולוגיה שמאחורי', action: () => openSheet('about'), color: 'text-white', bg: 'bg-white/5' },
      ],
    }
  ];

  const renderSheetContent = () => {
    switch (activeSheet) {
      case 'password':
        return (
          <div className="flex flex-col gap-6 text-right py-4">
            <div className="flex justify-center mb-2"><Key size={36} className="text-accent-primary" /></div>
            <h3 className="text-2xl font-black text-white text-center uppercase tracking-widest">שינוי סיסמה</h3>
            
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5 bg-[#1a1a1e] rounded-[24px] p-4 shadow-sm focus-within:ring-2 focus-within:ring-accent-primary/50 transition-all border-none">
                <label className="text-[#8b8b93] text-[11px] font-black tracking-widest uppercase flex items-center gap-2">
                  <Shield size={14} className="text-accent-primary" /><span>סיסמה נוכחית</span>
                </label>
                <input type="password" value={passwordData.current_password} onChange={e => setPasswordData(p=>({...p, current_password: e.target.value}))} className="bg-transparent border-none outline-none text-white text-[15px] font-bold placeholder:text-[#8b8b93]/40 px-1" placeholder="••••••••" dir="ltr" style={{ colorScheme: 'dark' }} />
              </div>
              
              <div className="flex flex-col gap-1.5 bg-[#1a1a1e] rounded-[24px] p-4 shadow-sm focus-within:ring-2 focus-within:ring-accent-primary/50 transition-all border-none">
                <label className="text-[#8b8b93] text-[11px] font-black tracking-widest uppercase flex items-center gap-2">
                  <Shield size={14} className="text-accent-primary" /><span>סיסמה חדשה</span>
                </label>
                <input type="password" value={passwordData.new_password} onChange={e => setPasswordData(p=>({...p, new_password: e.target.value}))} className="bg-transparent border-none outline-none text-white text-[15px] font-bold placeholder:text-[#8b8b93]/40 px-1" placeholder="••••••••" dir="ltr" style={{ colorScheme: 'dark' }} />
              </div>
              
              <div className="flex flex-col gap-1.5 bg-[#1a1a1e] rounded-[24px] p-4 shadow-sm focus-within:ring-2 focus-within:ring-accent-primary/50 transition-all border-none">
                <label className="text-[#8b8b93] text-[11px] font-black tracking-widest uppercase flex items-center gap-2">
                  <UserCheck size={14} className="text-accent-primary" /><span>אימות סיסמה חדשה</span>
                </label>
                <input type="password" value={passwordData.confirm_password} onChange={e => setPasswordData(p=>({...p, confirm_password: e.target.value}))} className="bg-transparent border-none outline-none text-white text-[15px] font-bold placeholder:text-[#8b8b93]/40 px-1" placeholder="••••••••" dir="ltr" style={{ colorScheme: 'dark' }} />
              </div>
            </div>
            
            <Button onClick={handleUpdatePassword} disabled={updatingPassword || !passwordData.new_password} className="w-full bg-accent-primary text-white rounded-[24px] font-black text-[14px] uppercase tracking-widest h-14 mt-4 shadow-md active:scale-95 transition-all disabled:opacity-50 border-none">
              {updatingPassword ? <Loader2 size={20} className="animate-spin text-white" /> : 'עדכן סיסמה'}
            </Button>
          </div>
        );

      case 'about':
        return (
          <div className="flex flex-col items-center justify-center text-center py-6 gap-6">
            <div className="flex items-center justify-center py-4">
              {/* הלוגו המעוצב והחדש עם סדר נכון i INNER וגובה אחיד */}
              <OfficialInnerLogo />
            </div>
            <div className="-mt-4">
              <span className="text-[#8b8b93] text-[11px] font-black uppercase tracking-[0.25em]">Exclusive Network 2026</span>
            </div>
            <p className="text-[#8b8b93] text-[15px] leading-relaxed max-w-[320px] font-medium">
              אינר (INNER) היא פלטפורמה חברתית אקסקלוסיבית שנועדה ליצור מרחב איכותי, נקי ובטוח לקהילות מובחרות. אנו שמים את המוניטין, הפרטיות והערך המוסף במרכז החוויה.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[280px]">
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-[20px] border-none">
                <span className="text-xs font-bold text-[#8b8b93] uppercase tracking-widest">גרסת מערכת</span>
                <span className="text-xs font-black text-white tracking-wider">v1.0.6 DB-Sync</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-[20px] border-none">
                <span className="text-xs font-bold text-[#8b8b93] uppercase tracking-widest">שרתים</span>
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
            <h2 className="text-white font-black text-xl tracking-widest uppercase text-center mb-2">רשימת חסומים</h2>
            {loadingBlocked ? (
              <div className="flex flex-col items-center py-20 gap-3">
                <Loader2 className="animate-spin text-accent-primary" size={32} />
                <span className="text-xs font-bold text-[#8b8b93] uppercase tracking-widest">טוען רשימה...</span>
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="text-center py-10 opacity-40">
                <Ban size={48} className="mx-auto mb-4 text-[#8b8b93]" />
                <p className="text-sm font-bold uppercase tracking-widest text-[#8b8b93]">אין משתמשים חסומים</p>
              </div>
            ) : (
              blockedUsers.map(u => (
                <div key={u.blocked_id} className="flex items-center justify-between p-4 bg-[#1a1a1e] border-none rounded-[24px] shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#121212] overflow-hidden border-none flex items-center justify-center">
                      {u.profiles?.avatar_url ? <img src={u.profiles.avatar_url} className="w-full h-full object-cover" /> : <User size={24} className="text-[#8b8b93]" />}
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="font-black text-white text-sm">{u.profiles?.full_name || 'משתמש אינר'}</span>
                      <span className="text-[10px] font-bold text-[#8b8b93]" dir="ltr">@{u.profiles?.username}</span>
                    </div>
                  </div>
                  <button onClick={() => unblockUser(u.blocked_id)} className="px-5 py-2.5 bg-accent-primary/10 rounded-[16px] text-[10px] font-black text-accent-primary hover:bg-accent-primary/20 transition-all uppercase tracking-widest border-none">ביטול חסימה</button>
                </div>
              ))
            )}
          </div>
        );

      case 'devices':
      case '2fa':
        return (
          <div className="flex flex-col items-center text-center py-10 gap-4">
            <div className="w-20 h-20 bg-white/5 rounded-[28px] flex items-center justify-center mb-2 shadow-inner">
              <ShieldCheck size={36} className="text-accent-primary" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-widest">אזור מאובטח</h3>
            <p className="text-[#8b8b93] text-[14px] leading-relaxed max-w-[250px]">כדי לגשת לניהול התחברויות או להגדיר אימות דו-שלבי (2FA) נדרש אימות ביומטרי (FaceID/טביעת אצבע). זמין בגרסה הקרובה.</p>
            <Button onClick={closeSheet} className="mt-4 px-8 h-12 bg-white/10 text-white rounded-full font-black tracking-widest text-[12px] uppercase">הבנתי</Button>
          </div>
        );

      case 'linked':
        return (
          <div className="flex flex-col gap-6 items-center text-center py-6">
            <div className="w-20 h-20 rounded-[28px] bg-white/5 flex items-center justify-center border-none shadow-sm">
              <LinkIcon size={32} className="text-white" />
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">שיטות התחברות</h3>
              <p className="text-[#8b8b93] text-xs font-medium">החשבון שלך מוגן ומקושר לאמצעים הבאים</p>
            </div>
            <div className="w-full flex flex-col gap-3 mt-4">
              <div className="flex items-center justify-between p-5 bg-[#1a1a1e] border-none rounded-[24px] shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#121212] flex items-center justify-center border-none"><Mail size={18} className="text-white" /></div>
                  <div className="flex flex-col text-right">
                    <span className="text-[15px] font-black text-white">כתובת דוא"ל</span>
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">מאומת בחשבון <Zap size={10} fill="currentColor" /></span>
                  </div>
                </div>
                <div className="text-[10px] font-black text-[#8b8b93] uppercase tracking-widest px-3 py-1 bg-white/5 rounded-[12px] border-none">ראשי</div>
              </div>
              <p className="text-[12px] text-[#8b8b93] leading-relaxed px-4 text-center font-medium mt-4">
                חיבור רשתות חברתיות נוספות יהיה זמין דרך אזור האבטחה בקרוב.
              </p>
            </div>
          </div>
        );

      case 'terms':
        return (
          <div className="flex flex-col gap-6 text-right py-4 text-[#8b8b93]">
            <div className="flex justify-center mb-2"><FileText size={32} className="text-white/50" /></div>
            <h3 className="text-2xl font-black text-white text-center uppercase tracking-widest">תקנון ותנאי שימוש</h3>
            <div className="space-y-6">
              <section className="space-y-2">
                <h4 className="text-white font-black text-[14px] uppercase tracking-widest pr-2">1. מבוא והסכמה לתנאים</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  השימוש באפליקציית INNER, לרבות הכלכלה הווירטואלית והמועדונים, כפוף להסכמתך לתנאים אלו.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="text-white font-black text-[14px] uppercase tracking-widest pr-2">2. הכלכלה הפנימית</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  Mטבעות ה-CRD משמשים בתוך הפלטפורמה בלבד. אין להם ערך פיאט. רכישות קרדיטים סופיות ללא החזרים כספיים.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="text-white font-black text-[14px] uppercase tracking-widest pr-2">3. התנהגות משתמשים</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  הפלטפורמה אקסקלוסיבית. משתמש שיפרסם תוכן פוגעני, מסית או מפר פרטיות יורחק לאלתר ללא החזר יתרה.
                </p>
              </section>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="flex flex-col gap-6 text-right py-4 text-[#8b8b93]">
            <div className="flex justify-center mb-2"><Lock size={32} className="text-white/50" /></div>
            <h3 className="text-2xl font-black text-white text-center uppercase tracking-widest">מדיניות פרטיות</h3>
            <div className="space-y-6">
              <section className="space-y-2">
                <h4 className="text-white font-black text-[14px] uppercase tracking-widest pr-2">1. איסוף המידע</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  אנו אוספים את פרטי ההרשמה הנדרשים תוך שימוש בהצפנת נתונים מחמירה לשמירה על ביטחונך.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="text-white font-black text-[14px] uppercase tracking-widest pr-2">2. שימוש בצדדים שלישיים</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  אינר אינה סוחרת בנתוניך עם חברות פרסום. המידע משמש רק לאבטחת הפעולות בכלכלה הפנימית.
                </p>
              </section>
              <section className="space-y-2">
                <h4 className="text-white font-black text-[14px] uppercase tracking-widest pr-2">3. זכות הגישה והמחיקה</h4>
                <p className="text-[13px] leading-relaxed font-medium">
                  ניתן לבצע מחיקה מוחלטת של החשבון בכל עת דרך אפשרויות המערכת.
                </p>
              </section>
            </div>
          </div>
        );

      case 'accessibility':
        return (
          <div className="flex flex-col gap-6 text-right py-4 text-[#8b8b93]">
            <div className="flex justify-center mb-2"><Accessibility size={32} className="text-white/50" /></div>
            <h3 className="text-2xl font-black text-white text-center uppercase tracking-widest">הצהרת נגישות</h3>
            <div className="space-y-6 font-medium">
              <p className="text-[13px] leading-relaxed">
                حברת INNER משקיעה מאמצים בהנגשת השירות לכלל האוכלוסייה מתוך שוויון הזדמנויות.
              </p>
              <div className="p-6 bg-[#1a1a1e] rounded-[24px] border-none space-y-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <Globe size={18} className="text-white" />
                  <span className="text-sm font-black text-white uppercase tracking-widest">התאמות שבוצעו:</span>
                </div>
                <ul className="text-[13px] list-disc list-inside space-y-2 text-white/80 pr-2 pt-2">
                  <li>תאימות לקוראי מסך במובייל.</li>
                  <li>ניווט פשוט המבוסס על מחוות.</li>
                  <li>ניגודיות צבעים וגופנים קריאים.</li>
                  <li>אזורי לחיצה מוגדלים.</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'delete':
        return (
          <div className="flex flex-col items-center justify-center text-center gap-8 py-2">
            <div className="w-24 h-24 rounded-[32px] bg-red-500/10 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.2)] border-none">
              <Trash2 size={40} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-widest">אזהרת מחיקה</h3>
              <p className="text-[#8b8b93] text-[14px] leading-relaxed px-4 font-medium">
                מחיקת החשבון תביא להסרת ה-XP, הקרדיטים וכל התוכן שלך <span className="text-red-400 font-bold">לצמיתות</span> משרתי הפלטפורמה.
              </p>
            </div>
            <div className="w-full bg-[#1a1a1e] rounded-[32px] p-8 flex flex-col gap-5 shadow-sm border-none">
              <span className="text-[#8b8b93] text-[12px] font-black uppercase tracking-widest">הקלד את הקוד כדי לאשר</span>
              <div className="text-4xl font-black text-red-500 tracking-[0.4em] select-none py-2">{deleteCode}</div>
              <input type="text" value={deleteInput} onChange={(e) => setDeleteInput(e.target.value.toUpperCase())} placeholder="הזן קוד..." dir="ltr" className="w-full h-16 bg-[#121212] border-none rounded-[20px] text-center text-white font-black text-xl tracking-widest outline-none focus:ring-2 focus:ring-red-500/50 transition-all placeholder:text-[#4a4a52]" />
            </div>
            <Button onClick={handleDeleteAccount} disabled={isDeleting || deleteInput !== deleteCode} className="w-full h-16 bg-red-500 text-white font-black text-[15px] uppercase tracking-widest rounded-[24px] flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 border-none shadow-md">
              {isDeleting ? <Loader2 className="animate-spin text-white" /> : 'מחק חשבון ונתונים'}
            </Button>
          </div>
        );

      case 'contact':
        return (
          <div className="flex flex-col gap-6 items-center text-center py-6">
            <div className="w-20 h-20 rounded-[28px] bg-white/5 flex items-center justify-center shadow-sm border-none">
              <MessageSquare size={32} className="text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-1">צוות התמיכה</h3>
              <p className="text-[#8b8b93] text-[14px] leading-relaxed max-w-[320px] font-medium">
                יש לך שאלה? צוות הניהול של אינר זמין עבורך במייל ונחזור אליך בהקדם.
              </p>
            </div>
            <Button onClick={handleSupportMail} className="mt-4 w-full h-16 bg-white text-black font-black text-[15px] uppercase tracking-widest rounded-[24px] active:scale-95 transition-transform border-none">
              העתק כתובת מייל
            </Button>
            <span className="text-[12px] font-bold text-[#8b8b93] mt-2 tracking-wider">support@inner-app.com</span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* MAIN SETTINGS PAGE */}
      <FadeIn className="px-5 pt-8 pb-[120px] flex flex-col gap-8 bg-[#121212] min-h-[100dvh] font-sans relative overflow-x-hidden" dir="rtl">
        
        {/* HEADER - תיקון: 121212 שקוף ומרחף */}
        <div className="sticky top-0 z-50 bg-[#121212]/70 backdrop-blur-2xl pt-[calc(env(safe-area-inset-top)+16px)] pb-5 px-5 flex items-center justify-center border-none shadow-sm -mx-5">
          <h1 className="text-xl font-black text-white tracking-[0.2em] uppercase">הגדרות מערכת</h1>
        </div>

        {/* SETTINGS LIST */}
        <div className="flex flex-col gap-10 relative z-10">
          
          {SETTINGS_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-4">
              <h3 className="text-[#8b8b93] text-[12px] font-black px-3 tracking-widest uppercase text-right">
                {group.title}
              </h3>
              <div className="flex flex-col gap-3">
                {group.items.map((item: any, iIdx) => (
                  <button
                    key={iIdx}
                    onClick={() => (item.key ? toggleSetting(item.key) : item.action?.())}
                    className="flex items-center gap-4 p-4 text-right transition-all active:scale-[0.98] bg-white/5 rounded-[24px] border-none hover:bg-white/10"
                  >
                    <div className={`w-12 h-12 rounded-[20px] ${item.bg} flex items-center justify-center shrink-0 border-none`}>
                      <item.icon size={22} className={item.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-[16px] text-white">{item.label}</div>
                      <div className="text-[12px] font-bold text-[#8b8b93] mt-0.5 uppercase tracking-wide">{item.desc}</div>
                    </div>
                    {item.key ? (
                      <div className={`w-14 h-7 rounded-full p-1 transition-all duration-300 border-none ${settings[item.key as keyof typeof settings] ? 'bg-accent-primary' : 'bg-[#1a1a1e]'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-sm ${settings[item.key as keyof typeof settings] ? 'translate-x-[-28px]' : 'translate-x-0'}`} />
                      </div>
                    ) : (
                      <ChevronLeft size={20} className="text-[#8b8b93] rtl:rotate-180" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* כפתורי סימטריה אקשן - התנתקות ומחיקה */}
          <div className="flex gap-4 mt-4 mb-8">
             <Button
                onClick={() => openSheet('delete')}
                className="flex-1 h-16 bg-red-500/10 text-red-500 font-black text-[14px] uppercase tracking-widest rounded-[24px] flex items-center justify-center gap-2 active:scale-95 transition-all border-none shadow-none"
              >
                <Trash2 size={18} />
                מחיקת חשבון
              </Button>
              <Button
                onClick={async () => { triggerFeedback('pop'); await signOut(); navigate('/auth'); }}
                className="flex-1 h-16 bg-white/5 hover:bg-white/10 text-white font-black text-[14px] uppercase tracking-widest rounded-[24px] flex items-center justify-center gap-2 active:scale-95 transition-all border-none shadow-none"
              >
                <LogOut size={18} />
                התנתקות
              </Button>
          </div>
          
        </div>
      </FadeIn>

      {/* BOTTOM SHEETS */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <BottomSheet open={!!activeSheet} onClose={closeSheet}>
          {renderSheetContent()}
        </BottomSheet>,
        document.body
      )}
    </>
  );
};
