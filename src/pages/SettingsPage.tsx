import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Shield,
  FileText,
  Info,
  LogOut,
  ChevronLeft,
  Volume2,
  Vibrate,
  AlertTriangle,
  Accessibility,
  Trash2,
  UserCog,
  Link as LinkIcon,
  Ban,
  MessageSquare,
  Mail,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

type ActiveSheet =
  | 'linked'
  | 'blocked'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'accessibility'
  | 'about'
  | 'delete'
  | null;

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [deleteCode, setDeleteCode] = useState('');
  const [deleteInput, setDeleteInput] = useState('');

  const [settings, setSettings] = useState({
    push: localStorage.getItem('inner_push') !== 'false',
    sound: localStorage.getItem('inner_sound') !== 'false',
    haptic: localStorage.getItem('inner_haptic') !== 'false',
  });

  const stateRef = useRef({ sheet: false });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    stateRef.current = { sheet: !!activeSheet };
  }, [activeSheet]);

  useEffect(() => {
    const handlePopState = () => {
      if (stateRef.current.sheet) {
        setActiveSheet(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      await navigator.clipboard.writeText('support@inner.app');
      toast.success('כתובת התמיכה הועתקה');
      triggerFeedback('success');
    } catch {
      toast.error('לא הצלחתי להעתיק את כתובת התמיכה');
      triggerFeedback('error');
    }
  };

  const SETTINGS_GROUPS = [
    {
      title: 'חשבון',
      items: [
        {
          icon: UserCog,
          label: 'עריכת פרופיל',
          desc: 'שם תמונה וביו',
          action: () => {
            triggerFeedback('pop');
            navigate('/edit-profile');
          },
          color: 'text-accent-primary',
          bg: 'bg-accent-primary/10',
        },
        {
          icon: LinkIcon,
          label: 'חשבונות מקושרים',
          desc: 'Google ו Apple',
          action: () => openSheet('linked'),
          color: 'text-brand',
          bg: 'bg-white/5',
        },
      ],
    },
    {
      title: 'מערכת',
      items: [
        {
          icon: Bell,
          label: 'התראות פוש',
          desc: 'דרופים והודעות',
          key: 'push',
          color: 'text-brand',
          bg: 'bg-white/5',
        },
        {
          icon: Volume2,
          label: 'צלילי אפליקציה',
          desc: 'סאונד לפעולות',
          key: 'sound',
          color: 'text-brand',
          bg: 'bg-white/5',
        },
        {
          icon: Vibrate,
          label: 'רטט',
          desc: 'תחושה באינטראקציות',
          key: 'haptic',
          color: 'text-brand',
          bg: 'bg-white/5',
        },
      ],
    },
    {
      title: 'פרטיות ואבטחה',
      items: [
        {
          icon: Shield,
          label: 'מדיניות פרטיות',
          desc: 'איך נשמר המידע שלך',
          action: () => openSheet('privacy'),
          color: 'text-brand',
          bg: 'bg-white/5',
        },
        {
          icon: Ban,
          label: 'משתמשים חסומים',
          desc: 'ניהול רשימת חסימות',
          action: () => openSheet('blocked'),
          color: 'text-brand',
          bg: 'bg-white/5',
        },
        {
          icon: Trash2,
          label: 'מחיקת חשבון',
          desc: 'פעולה בלתי הפיכה',
          action: () => openSheet('delete'),
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          isDanger: true,
        },
      ],
    },
    {
      title: 'מידע ותמיכה',
      items: [
        {
          icon: FileText,
          label: 'תנאי שימוש',
          desc: 'המסמך המשפטי',
          action: () => openSheet('terms'),
          color: 'text-brand',
          bg: 'bg-white/5',
        },
        {
          icon: Accessibility,
          label: 'נגישות',
          desc: 'התאמות דיגיטליות',
          action: () => openSheet('accessibility'),
          color: 'text-brand',
          bg: 'bg-white/5',
        },
        {
          icon: MessageSquare,
          label: 'יצירת קשר',
          desc: 'פנייה לצוות התמיכה',
          action: () => openSheet('contact'),
          color: 'text-brand',
          bg: 'bg-white/5',
        },
        {
          icon: Info,
          label: 'אודות',
          desc: 'פרטי המערכת',
          action: () => openSheet('about'),
          color: 'text-brand',
          bg: 'bg-white/5',
        },
      ],
    },
  ];

  const getSheetTitle = () => {
    switch (activeSheet) {
      case 'linked':
        return 'חשבונות מקושרים';
      case 'blocked':
        return 'משתמשים חסומים';
      case 'contact':
        return 'יצירת קשר';
      case 'privacy':
        return 'מדיניות פרטיות';
      case 'terms':
        return 'תנאי שימוש';
      case 'accessibility':
        return 'נגישות';
      case 'about':
        return 'אודות';
      case 'delete':
        return 'מחיקת חשבון';
      default:
        return '';
    }
  };

  const renderSheetContent = () => {
    switch (activeSheet) {
      case 'about':
        return (
          <div className="flex flex-col items-center justify-center text-center py-6 gap-4">
            <div className="w-20 h-20 rounded-[24px] bg-surface border border-surface-border flex items-center justify-center shadow-inner">
              <SettingsIcon size={30} className="text-accent-primary" />
            </div>
            <h2 className="text-3xl font-black text-brand tracking-tight">INNER</h2>
            <span className="text-brand-muted text-[11px] font-black uppercase tracking-[0.25em]">
              VIP Edition v1.0.0
            </span>
            <p className="text-brand-muted text-sm leading-relaxed max-w-[320px]">
              INNER נבנתה כדי ליצור מרחב אקסקלוסיבי לקהילות, עם חוויית שימוש נקייה,
              מהירה ומדויקת.
            </p>
          </div>
        );

      case 'linked':
        return (
          <div className="flex flex-col gap-4 items-center text-center py-6">
            <div className="w-16 h-16 rounded-[20px] bg-neutral-100 border border-neutral-200 flex items-center justify-center">
              <LinkIcon size={26} className="text-accent-primary" />
            </div>
            <h3 className="text-xl font-black text-black">חשבונות מקושרים</h3>
            <p className="text-neutral-600 text-sm leading-relaxed max-w-[320px]">
              כרגע החשבון שלך מנוהל באמצעות התחברות רגילה. חיבורי Google ו Apple
              יתווספו בהמשך.
            </p>
          </div>
        );

      case 'blocked':
        return (
          <div className="flex flex-col gap-4 items-center text-center py-6">
            <div className="w-16 h-16 rounded-[20px] bg-neutral-100 border border-neutral-200 flex items-center justify-center">
              <Ban size={26} className="text-neutral-500" />
            </div>
            <h3 className="text-xl font-black text-black">אין משתמשים חסומים</h3>
            <p className="text-neutral-600 text-sm leading-relaxed max-w-[320px]">
              ברגע שתחסום משתמשים, תוכל לראות ולנהל אותם כאן.
            </p>
          </div>
        );

      case 'contact':
        return (
          <div className="flex flex-col gap-4 items-center text-center py-6">
            <div className="w-16 h-16 rounded-[20px] bg-accent-primary/10 border border-accent-primary/15 flex items-center justify-center">
              <Mail size={26} className="text-accent-primary" />
            </div>
            <h3 className="text-xl font-black text-black">צריך עזרה?</h3>
            <p className="text-neutral-600 text-sm leading-relaxed max-w-[320px]">
              צוות התמיכה של INNER זמין עבורך לכל שאלה, תקלה או בעיה טכנית.
            </p>
            <button
              onClick={handleSupportMail}
              className="mt-2 px-6 h-12 bg-black text-white font-black rounded-2xl active:scale-[0.98] transition-transform"
            >
              העתק כתובת תמיכה
            </button>
          </div>
        );

      case 'privacy':
        return (
          <div className="flex flex-col gap-4 text-right py-2">
            <h3 className="text-lg font-black text-black">מבוא</h3>
            <p className="text-neutral-700 text-sm leading-relaxed">
              אנו מכבדים את פרטיותך. מסמך זה מסביר כיצד אנו אוספים, משתמשים ושומרים
              על המידע האישי שלך בעת השימוש באפליקציית INNER.
            </p>

            <h3 className="text-lg font-black text-black mt-2">איסוף מידע</h3>
            <p className="text-neutral-700 text-sm leading-relaxed">
              אנו אוספים מידע שנמסר על ידך באופן יזום, כגון שם, אימייל ותמונת
              פרופיל, וכן מידע טכני בסיסי לצורכי תפעול, אבטחה ושיפור המערכת.
            </p>

            <h3 className="text-lg font-black text-black mt-2">שימוש במידע</h3>
            <p className="text-neutral-700 text-sm leading-relaxed">
              המידע משמש לתפעול האפליקציה, שיפור חוויית המשתמש, מניעת הונאות,
              ואבטחת מידע. איננו מוכרים את המידע שלך לצדדים שלישיים.
            </p>
          </div>
        );

      case 'terms':
        return (
          <div className="flex flex-col gap-4 text-right py-2">
            <h3 className="text-lg font-black text-black">הסכמה לתנאים</h3>
            <p className="text-neutral-700 text-sm leading-relaxed">
              עצם ההרשמה והשימוש באפליקציית INNER מהווים את הסכמתך המלאה לתנאים
              המפורטים במסמך זה.
            </p>

            <h3 className="text-lg font-black text-black mt-2">תוכן גולשים</h3>
            <p className="text-neutral-700 text-sm leading-relaxed">
              כל משתמש אחראי לתוכן שהוא מעלה למערכת. חל איסור על תוכן פוגעני,
              מפר זכויות, או כזה המנוגד לחוק.
            </p>

            <h3 className="text-lg font-black text-black mt-2">רכישות וירטואליות</h3>
            <p className="text-neutral-700 text-sm leading-relaxed">
              מטבעות CRD ובוסטים וירטואליים הנרכשים באפליקציה אינם ניתנים להמרה
              למטבע פיאט, וכל רכישה הינה סופית.
            </p>
          </div>
        );

      case 'accessibility':
        return (
          <div className="flex flex-col gap-4 text-right py-2">
            <h3 className="text-lg font-black text-black">מחויבות לנגישות</h3>
            <p className="text-neutral-700 text-sm leading-relaxed">
              אנו רואים חשיבות עליונה במתן שירות נגיש לכלל המשתמשים, לרבות אנשים עם
              מוגבלויות.
            </p>

            <h3 className="text-lg font-black text-black mt-2">אמצעי נגישות</h3>
            <p className="text-neutral-700 text-sm leading-relaxed">
              המערכת פועלת לשיפור תאימות לקוראי מסך, ניגודיות, ניווט ברור, וטקסטים
              קריאים בהתאם לסטנדרטים מקובלים.
            </p>
          </div>
        );

      case 'delete':
        return (
          <div className="flex flex-col items-center justify-center text-center gap-5 py-2">
            <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
              <AlertTriangle size={30} className="text-red-500" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-black mb-2">אזהרת מחיקה לצמיתות</h3>
              <p className="text-neutral-600 text-sm leading-relaxed px-2">
                פעולה זו <span className="text-red-500 font-bold">תמחק באופן בלתי הפיך</span>{' '}
                את החשבון, הפוסטים והארנק שלך.
              </p>
            </div>

            <div className="w-full bg-red-50 border border-red-100 rounded-[24px] p-4 flex flex-col gap-3 shadow-inner">
              <span className="text-neutral-500 text-[11px] font-bold uppercase tracking-widest">
                כדי לאשר, הקלד את הקוד הבא
              </span>

              <div className="text-2xl font-black text-black tracking-[0.3em] select-none bg-white py-3 rounded-2xl border border-red-100">
                {deleteCode}
              </div>

              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
                placeholder="הקלד את הקוד כאן"
                dir="ltr"
                className="w-full h-14 mt-1 bg-white border border-neutral-200 rounded-2xl text-center text-black font-black text-lg tracking-widest focus:border-red-300 outline-none transition-all placeholder:text-neutral-400 placeholder:text-sm placeholder:tracking-normal"
              />
            </div>

            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteInput !== deleteCode}
              className="w-full mt-1 h-14 bg-red-500 hover:bg-red-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(239,68,68,0.18)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:shadow-none"
            >
              {isDeleting ? 'מוחק נתונים...' : 'כן, מחק את החשבון שלי'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <FadeIn
        className="px-4 pt-5 pb-32 flex flex-col gap-5 bg-surface min-h-screen font-sans relative"
        dir="rtl"
      >
        <div className="flex flex-col gap-5 relative z-10">
          {SETTINGS_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-3">
              <h3 className="text-brand-muted text-[10px] font-black px-2 tracking-widest uppercase text-right">
                {group.title}
              </h3>

              <div className="bg-surface-card border border-surface-border rounded-[28px] overflow-hidden flex flex-col shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
                {group.items.map((item: any, iIdx) => (
                  <button
                    key={iIdx}
                    onClick={() => (item.key ? toggleSetting(item.key) : item.action?.())}
                    className={`flex items-center gap-4 p-4 text-right transition-all active:scale-[0.995] ${
                      iIdx !== group.items.length - 1 ? 'border-b border-surface-border' : ''
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-[16px] ${item.bg} border ${
                        item.isDanger ? 'border-red-500/20' : 'border-white/5'
                      } flex items-center justify-center shrink-0 shadow-inner`}
                    >
                      <item.icon size={18} className={item.color} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-black text-sm ${
                          item.isDanger ? 'text-red-500' : 'text-brand'
                        }`}
                      >
                        {item.label}
                      </div>
                      <div className="text-[10px] font-bold text-brand-muted mt-0.5">
                        {item.desc}
                      </div>
                    </div>

                    {item.key ? (
                      <div
                        className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${
                          settings[item.key as keyof typeof settings]
                            ? 'bg-accent-primary/20 border border-accent-primary/30'
                            : 'bg-surface border border-surface-border'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full transition-transform duration-300 ${
                            settings[item.key as keyof typeof settings]
                              ? 'bg-accent-primary translate-x-[-24px]'
                              : 'bg-white/30 translate-x-0'
                          }`}
                        />
                      </div>
                    ) : (
                      <ChevronLeft
                        size={16}
                        className={`${
                          item.isDanger ? 'text-red-300' : 'text-brand-muted'
                        } transition-colors`}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 relative z-10">
          <Button
            onClick={async () => {
              triggerFeedback('pop');
              await signOut();
              navigate('/auth');
            }}
            className="w-full h-14 bg-red-50 border border-red-100 text-red-500 font-black rounded-[24px] flex items-center justify-center gap-2 shadow-inner transition-all active:scale-[0.98]"
          >
            <LogOut size={18} />
            התנתק מהמערכת
          </Button>
        </div>
      </FadeIn>

      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {activeSheet && (
              <div
                className="fixed inset-0 z-[9999999] flex flex-col justify-end"
                dir="rtl"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={closeSheet}
                />

                <motion.div
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.22}
                  onDragEnd={(e, info) => {
                    if (info.offset.y > 100 || info.velocity.y > 500) closeSheet();
                  }}
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                  className="relative z-10 bg-white rounded-t-[36px] h-[85vh] flex flex-col overflow-hidden pb-10 shadow-[0_-10px_50px_rgba(0,0,0,0.18)]"
                >
                  <div className="w-full py-5 flex justify-center cursor-grab active:cursor-grabbing border-b border-black/5">
                    <div className="w-16 h-1.5 bg-black/10 rounded-full" />
                  </div>

                  <div className="flex justify-center items-center px-6 pb-4 pt-4 border-b border-black/5">
                    <h2 className="text-black/80 font-black text-lg tracking-wide">
                      {getSheetTitle()}
                    </h2>
                  </div>

                  <div
                    className="flex-1 overflow-y-auto p-6 scrollbar-hide overscroll-none"
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
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
