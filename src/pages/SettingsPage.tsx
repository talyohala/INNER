import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Lock, Shield, FileText, Info, LogOut, ChevronLeft, Volume2, Vibrate, ArrowRight, Settings as SettingsIcon, AlertTriangle, Accessibility, Trash2, UserCog, Link as LinkIcon, Ban, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { GlassCard, FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [settings, setSettings] = useState({
    push: localStorage.getItem('inner_push') !== 'false',
    sound: localStorage.getItem('inner_sound') !== 'false',
    haptic: localStorage.getItem('inner_haptic') !== 'false',
  });

  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // משתנים עבור מנגנון הגנת מחיקת חשבון
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteInput, setDeleteInput] = useState('');

  const toggleSetting = (key: keyof typeof settings) => {
    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    localStorage.setItem(`inner_${key}`, String(newValue));
    
    if (newValue) triggerFeedback('success');
    else triggerFeedback('pop');
  };

  const openSheet = (sheetName: string) => {
    triggerFeedback('pop');
    
    // אם המשתמש רוצה למחוק חשבון - נחולל קוד אימות רנדומלי וחדש
    if (sheetName === 'delete') {
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      setDeleteCode(randomCode);
      setDeleteInput('');
    }
    
    setActiveSheet(sheetName);
  };

  const closeSheet = () => {
    if (activeSheet) triggerFeedback('pop');
    setActiveSheet(null);
  };

  const handleDeleteAccount = async () => {
    // וידוא כפול גם ברמת הקוד
    if (deleteInput !== deleteCode) {
      triggerFeedback('error');
      return toast.error('קוד האימות אינו תואם');
    }

    triggerFeedback('error');
    setIsDeleting(true);
    const tid = toast.loading('מוחק נתונים מהשרת...');
    
    try {
      // קריאה אמיתית לשרת למחיקת החשבון מה-DB (דרך הנתיב שניצור בבקאנד)
      await apiFetch('/api/account', { method: 'DELETE' });
      
      toast.success('החשבון נמחק לצמיתות. להתראות!', { id: tid });
      await signOut(); // ניתוק ה-Session של סופבייס בלקוח
      navigate('/auth');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה במחיקת החשבון', { id: tid });
      setIsDeleting(false);
    }
  };

  const SETTINGS_GROUPS = [
    {
      title: 'הגדרות חשבון',
      items: [
        { icon: UserCog, label: 'עריכת פרופיל', desc: 'שינוי שם, תמונה וביו', action: () => { triggerFeedback('pop'); navigate('/edit-profile'); }, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        { icon: LinkIcon, label: 'חשבונות מקושרים', desc: 'חיבור Google, Apple', action: () => openSheet('linked'), color: 'text-blue-400', bg: 'bg-blue-500/10' }
      ]
    },
    {
      title: 'העדפות מערכת',
      items: [
        { icon: Bell, label: 'התראות פוש', desc: 'אל תפספס דרופים והודעות', key: 'push', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        { icon: Volume2, label: 'צלילי אפליקציה', desc: 'סאונד בעת פעולות במערכת', key: 'sound', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        { icon: Vibrate, label: 'רטט (Haptics)', desc: 'תחושה פיזית בכל אינטראקציה', key: 'haptic', color: 'text-pink-400', bg: 'bg-pink-500/10' },
      ]
    },
    {
      title: 'פרטיות ואבטחה',
      items: [
        { icon: Shield, label: 'מדיניות פרטיות', desc: 'איך אנחנו שומרים על המידע שלך', action: () => openSheet('privacy'), color: 'text-green-400', bg: 'bg-green-500/10' },
        { icon: Ban, label: 'משתמשים חסומים', desc: 'ניהול רשימת החסימות שלך', action: () => openSheet('blocked'), color: 'text-gray-400', bg: 'bg-white/10' },
        { icon: Trash2, label: 'מחיקת חשבון לצמיתות', desc: 'פעולה זו בלתי הפיכה', action: () => openSheet('delete'), color: 'text-red-500', bg: 'bg-red-500/10', isDanger: true }
      ]
    },
    {
      title: 'תמיכה ומידע',
      items: [
        { icon: FileText, label: 'תקנון ותנאי שימוש', desc: 'המסמך המשפטי המחייב', action: () => openSheet('terms'), color: 'text-gray-300', bg: 'bg-white/10' },
        { icon: Accessibility, label: 'הצהרת נגישות', desc: 'התאמות דיגיטליות במערכת', action: () => openSheet('accessibility'), color: 'text-teal-400', bg: 'bg-teal-500/10' },
        { icon: MessageSquare, label: 'יצירת קשר', desc: 'פנייה לצוות התמיכה הטכנית', action: () => openSheet('contact'), color: 'text-orange-400', bg: 'bg-orange-500/10' },
        { icon: Info, label: 'אודות INNER', desc: 'גרסה, זכויות והלוגו שלנו', action: () => openSheet('about'), color: 'text-indigo-400', bg: 'bg-indigo-500/10' }
      ]
    }
  ];

  const renderSheetContent = () => {
    switch (activeSheet) {
      case 'about':
        return (
          <div className="flex flex-col items-center justify-center text-center py-10 gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white/10 blur-[40px] rounded-full"></div>
              <h2 className="text-6xl font-black text-white tracking-tighter italic relative z-10 drop-shadow-2xl">INNER</h2>
            </div>
            <span className="text-white/40 text-xs font-black uppercase tracking-[0.3em]">VIP Edition v1.0.0</span>
            <p className="text-white/60 text-sm mt-4 px-6 leading-relaxed">
              INNER נבנתה במטרה לייצר מרחב אקסקלוסיבי לקהילות, בו סטטוס, ערך ואותנטיות נפגשים. 
              כל הזכויות שמורות לפיתוח המקורי.
            </p>
          </div>
        );
      case 'linked':
        return (
          <div className="flex flex-col gap-4 items-center text-center py-8">
            <LinkIcon size={48} className="text-white/20 mb-2" />
            <h3 className="text-xl font-black text-white">חשבונות מקושרים</h3>
            <p className="text-white/60 text-sm">כרגע החשבון שלך מנוהל באמצעות סיסמה בלבד. אפשרויות התחברות חברתיות יתווספו בעדכון הבא.</p>
          </div>
        );
      case 'blocked':
        return (
          <div className="flex flex-col gap-4 items-center text-center py-8">
            <Ban size={48} className="text-white/20 mb-2" />
            <h3 className="text-xl font-black text-white">אין משתמשים חסומים</h3>
            <p className="text-white/60 text-sm">המעגל שלך נקי. כשתחסום משתמשים במערכת, הם יופיעו כאן ותוכל לנהל אותם.</p>
          </div>
        );
      case 'contact':
        return (
          <div className="flex flex-col gap-4 items-center text-center py-8">
            <MessageSquare size={48} className="text-white/20 mb-2" />
            <h3 className="text-xl font-black text-white">צריך עזרה?</h3>
            <p className="text-white/60 text-sm mb-4">צוות התמיכה של INNER זמין עבורך 24/7 לכל תקלה או שאלה.</p>
            <button onClick={() => toast.success('הודעה הועתקה, פתח מייל לשלוח!')} className="px-6 py-3 bg-white text-black font-black rounded-xl text-sm active:scale-95 transition-all">
              שלח מייל לתמיכה
            </button>
          </div>
        );
      case 'privacy':
        return (
          <div className="flex flex-col gap-4 text-right">
            <h3 className="text-lg font-black text-white">מבוא</h3>
            <p className="text-white/70 text-sm leading-relaxed">אנו מכבדים את פרטיותך. מסמך זה נועד להסביר כיצד אנו אוספים, משתמשים ושומרים על המידע האישי שלך בעת השימוש באפליקציית INNER.</p>
            <h3 className="text-lg font-black text-white mt-2">איסוף מידע</h3>
            <p className="text-white/70 text-sm leading-relaxed">אנו אוספים מידע שהינך מוסר באופן אקטיבי (כגון שם, אימייל ותמונת פרופיל) וכן מידע טכני הנאסף באופן אוטומטי בעת השימוש במערכת (כתובת IP, סוג מכשיר ונתוני שימוש).</p>
            <h3 className="text-lg font-black text-white mt-2">שימוש במידע</h3>
            <p className="text-white/70 text-sm leading-relaxed">המידע נאסף אך ורק למטרות תפעול האפליקציה, שיפור חוויית המשתמש, מניעת הונאות ואבטחת מידע. איננו מוכרים את המידע שלך לצדדים שלישיים.</p>
          </div>
        );
      case 'terms':
        return (
          <div className="flex flex-col gap-4 text-right">
            <h3 className="text-lg font-black text-white">הסכמה לתנאים</h3>
            <p className="text-white/70 text-sm leading-relaxed">עצם ההרשמה והשימוש באפליקציית INNER מהווה את הסכמתך המלאה לתנאים המפורטים בתקנון זה. במידה ואינך מסכים לתנאים, עליך לחדול משימוש באפליקציה מיד.</p>
            <h3 className="text-lg font-black text-white mt-2">תוכן גולשים</h3>
            <p className="text-white/70 text-sm leading-relaxed">המשתמש נושא באחריות הבלעדית לכל תוכן המועלה על ידו למערכת. חל איסור מוחלט על העלאת תוכן פוגעני, מפר זכויות יוצרים, או מנוגד לחוק.</p>
            <h3 className="text-lg font-black text-white mt-2">רכישות וירטואליות</h3>
            <p className="text-white/70 text-sm leading-relaxed">מטבעות (CRD) ובוסטים וירטואליים הנרכשים באפליקציה אינם ניתנים להמרה למטבע פיאט. כל רכישה הינה סופית.</p>
          </div>
        );
      case 'accessibility':
        return (
          <div className="flex flex-col gap-4 text-right">
            <h3 className="text-lg font-black text-white">התחייבות לנגישות</h3>
            <p className="text-white/70 text-sm leading-relaxed">אנו רואים חשיבות עליונה במתן שירות שוויוני ונגיש לכלל המשתמשים, לרבות אנשים עם מוגבלויות. הושקעו מאמצים טכנולוגיים רבים כדי להנגיש את המערכת.</p>
            <h3 className="text-lg font-black text-white mt-2">אמצעי הנגישות</h3>
            <p className="text-white/70 text-sm leading-relaxed">האפליקציה תומכת בניווט מקלדת, קוראי מסך, ויחס ניגודיות המותאם לתקן WCAG 2.1 ברמת AA.</p>
          </div>
        );
      case 'delete':
        return (
          <div className="flex flex-col items-center justify-center text-center gap-5 py-2">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center animate-pulse">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">אזהרת מחיקה לצמיתות</h3>
              <p className="text-white/60 text-sm leading-relaxed px-2">
                פעולה זו <span className="text-red-400 font-bold">תמחק באופן בלתי הפיך</span> את המידע שלך, הפוסטים והארנק (CRD).
              </p>
            </div>

            {/* בלוק אימות קוד */}
            <div className="w-full bg-red-500/5 border border-red-500/20 rounded-2xl p-4 flex flex-col gap-3 mt-2 shadow-inner">
              <span className="text-white/60 text-[11px] font-bold uppercase tracking-widest">כדי לאשר, הקלד את הקוד הבא:</span>
              <div className="text-2xl font-black text-white tracking-[0.3em] select-none bg-black/60 py-3 rounded-xl border border-white/5">
                {deleteCode}
              </div>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
                placeholder="הקלד את הקוד כאן"
                dir="ltr"
                className="w-full h-14 mt-1 bg-[#050505] border border-white/10 rounded-xl text-center text-white font-black text-lg tracking-widest focus:border-red-500/50 outline-none transition-all placeholder:text-white/20 placeholder:text-sm placeholder:tracking-normal"
              />
            </div>

            <button 
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteInput !== deleteCode}
              className="w-full mt-2 h-14 bg-red-500 hover:bg-red-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:shadow-none"
            >
              {isDeleting ? 'מוחק נתונים...' : 'כן, מחק את החשבון שלי'}
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const getSheetTitle = () => {
    switch (activeSheet) {
      case 'linked': return 'חשבונות מקושרים';
      case 'blocked': return 'משתמשים חסומים';
      case 'contact': return 'יצירת קשר';
      case 'privacy': return 'מדיניות פרטיות';
      case 'terms': return 'תנאי שימוש';
      case 'accessibility': return 'הצהרת נגישות';
      case 'about': return 'אודות המערכת';
      case 'delete': return 'מחיקת חשבון';
      default: return '';
    }
  };

  return (
    <FadeIn className="px-5 pt-8 pb-32 flex flex-col gap-6 bg-[#030303] min-h-screen font-sans relative" dir="rtl">
      
      <div className="flex justify-between items-center mb-4 relative z-10">
        <div className="w-8"></div>
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <SettingsIcon size={20} className="text-white/40" /> הגדרות
          </h1>
          <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">שליטה מלאה</span>
        </div>
        <button onClick={() => { triggerFeedback('pop'); navigate(-1); }} className="w-8 h-8 flex justify-center items-center bg-white/5 rounded-full shadow-inner active:scale-90 transition-all">
          <ArrowRight size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-6 relative z-10">
        {SETTINGS_GROUPS.map((group, gIdx) => (
          <div key={gIdx} className="flex flex-col gap-3">
            <h3 className="text-white/40 text-[10px] font-black px-2 tracking-widest uppercase text-right">
              {group.title}
            </h3>
            
            <GlassCard className="p-0 bg-white/[0.02] border border-white/5 rounded-[28px] overflow-hidden flex flex-col shadow-lg">
              {group.items.map((item, iIdx) => (
                <button
                  key={iIdx}
                  onClick={() => item.key ? toggleSetting(item.key as any) : item.action?.()}
                  className={`flex items-center gap-4 p-4 text-right transition-all hover:bg-white/[0.04] active:scale-[0.98] group ${
                    iIdx !== group.items.length - 1 ? 'border-b border-white/5' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl ${item.bg} border ${item.isDanger ? 'border-red-500/20' : 'border-white/5'} flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform`}>
                    <item.icon size={18} className={item.color} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className={`font-black text-sm ${item.isDanger ? 'text-red-500' : 'text-white/90'}`}>{item.label}</div>
                    <div className="text-[10px] font-bold text-white/40 mt-0.5">{item.desc}</div>
                  </div>
                  
                  {item.key ? (
                    <div className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${
                      settings[item.key as keyof typeof settings] 
                        ? 'bg-green-500/20 border border-green-500/30 shadow-[0_0_10px_rgba(74,222,128,0.1)]' 
                        : 'bg-black/80 border border-white/10'
                    }`}>
                      <div className={`w-4 h-4 rounded-full transition-transform duration-300 ${
                        settings[item.key as keyof typeof settings] 
                          ? 'bg-green-400 translate-x-[-24px] shadow-[0_0_8px_rgba(74,222,128,0.8)]' 
                          : 'bg-white/30 translate-x-0'
                      }`} />
                    </div>
                  ) : (
                    <ChevronLeft size={16} className={`${item.isDanger ? 'text-red-500/30 group-hover:text-red-400' : 'text-white/20 group-hover:text-white/50'} transition-colors`} />
                  )}
                </button>
              ))}
            </GlassCard>
          </div>
        ))}
      </div>

      <div className="mt-4 relative z-10">
        <Button
          onClick={async () => { triggerFeedback('pop'); await signOut(); navigate('/auth'); }}
          className="w-full h-14 bg-white/[0.03] border border-white/10 text-white/70 hover:text-white hover:bg-white/10 font-black tracking-wide rounded-[24px] flex items-center justify-center gap-2 shadow-inner transition-all"
        >
          <LogOut size={18} /> התנתק מהמערכת
        </Button>
      </div>

      <AnimatePresence>
        {activeSheet && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm"
          >
            <div className="absolute inset-0" onClick={closeSheet}></div>
            
            <motion.div 
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.8 }}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.y > 100 || velocity.y > 500) closeSheet();
              }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-[#0A0A0A] border-t border-white/10 rounded-t-[32px] h-[85vh] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.8)] relative z-10"
              dir="rtl"
            >
              <div className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing">
                <div className="w-16 h-1.5 bg-white/20 rounded-full"></div>
              </div>

              <div className="flex justify-center items-center px-6 pb-4 border-b border-white/5">
                <h2 className="text-white/80 font-black text-lg tracking-wide">{getSheetTitle()}</h2>
              </div>

              <div className="flex-1 overflow-y-auto p-6 scrollbar-hide overscroll-none">
                {renderSheetContent()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </FadeIn>
  );
};
