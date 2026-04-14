import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Shield, FileText, Info, LogOut, ChevronLeft, Volume2, Vibrate,
  AlertTriangle, Accessibility, Trash2, UserCog, Link as LinkIcon, Ban,
  MessageSquare, Mail, Crown, EyeOff, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { FadeIn, Button } from '../components/ui';
import { triggerFeedback } from '../lib/sound';
import toast from 'react-hot-toast';

type ActiveSheet =
  | 'linked' | 'blocked' | 'contact' | 'privacy' | 'terms' | 'accessibility'
  | 'about' | 'delete' | null;

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
    ghostMode: localStorage.getItem('inner_ghost') === 'true',
    dmFilter: localStorage.getItem('inner_dm_filter') === 'true',
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
      if (stateRef.current.sheet) setActiveSheet(null);
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
      await navigator.clipboard.writeText('support@inner-app.com');
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
          icon: UserCog, label: 'עריכת פרופיל', desc: 'שם, תמונה וביו',
          action: () => { triggerFeedback('pop'); navigate('/edit-profile'); },
          color: 'text-accent-primary', bg: 'bg-accent-primary/10',
        },
        {
          icon: LinkIcon, label: 'חשבונות מקושרים', desc: 'חיבור Google / Apple',
          action: () => openSheet('linked'),
          color: 'text-brand', bg: 'bg-white/5',
        },
      ],
    },
    {
      title: 'העדפות ופרטיות',
      items: [
        {
          icon: EyeOff, label: 'מצב רפאים (Ghost Mode)', desc: 'הסתרת סטטוס מחובר מהרשת',
          key: 'ghostMode', color: 'text-brand', bg: 'bg-white/5',
        },
        {
          icon: Shield, label: 'מסנן הודעות קפדני', desc: 'רק חברים ומשתמשי CORE יוכלו לשלוח הודעות',
          key: 'dmFilter', color: 'text-brand', bg: 'bg-white/5',
        },
        {
          icon: Ban, label: 'משתמשים חסומים', desc: 'ניהול רשימת החסימות שלך',
          action: () => openSheet('blocked'), color: 'text-brand', bg: 'bg-white/5',
        }
      ],
    },
    {
      title: 'מערכת',
      items: [
        { icon: Bell, label: 'התראות פוש', desc: 'דרופים, חותמות והודעות', key: 'push', color: 'text-brand', bg: 'bg-white/5' },
        { icon: Volume2, label: 'צלילי אפליקציה', desc: 'סאונד לפעולות במערכת', key: 'sound', color: 'text-brand', bg: 'bg-white/5' },
        { icon: Vibrate, label: 'רטט (Haptics)', desc: 'תחושת מגע באינטראקציות', key: 'haptic', color: 'text-brand', bg: 'bg-white/5' },
      ],
    },
    {
      title: 'מידע משפטי ותמיכה',
      items: [
        { icon: FileText, label: 'תנאי שימוש ותקנון', desc: 'המסמך המשפטי המחייב', action: () => openSheet('terms'), color: 'text-brand', bg: 'bg-white/5' },
        { icon: Lock, label: 'מדיניות פרטיות', desc: 'איך אנו שומרים על המידע שלך', action: () => openSheet('privacy'), color: 'text-brand', bg: 'bg-white/5' },
        { icon: Accessibility, label: 'הצהרת נגישות', desc: 'התאמות לאנשים עם מוגבלות', action: () => openSheet('accessibility'), color: 'text-brand', bg: 'bg-white/5' },
        { icon: MessageSquare, label: 'יצירת קשר', desc: 'פנייה לצוות התמיכה', action: () => openSheet('contact'), color: 'text-brand', bg: 'bg-white/5' },
        { icon: Info, label: 'אודות INNER', desc: 'חזון הפלטפורמה וגרסה', action: () => openSheet('about'), color: 'text-brand', bg: 'bg-white/5' },
      ],
    },
    {
      title: 'אזור מסוכן',
      items: [
        { icon: Trash2, label: 'מחיקת חשבון', desc: 'מחיקה לצמיתות של כל הנתונים', action: () => openSheet('delete'), color: 'text-red-500', bg: 'bg-red-500/10', isDanger: true },
      ],
    },
  ];

  const renderSheetContent = () => {
    switch (activeSheet) {
      case 'about':
        return (
          <div className="flex flex-col items-center justify-center text-center py-6 gap-5">
            <div className="w-24 h-24 rounded-[32px] bg-surface border border-surface-border flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.3)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/20 to-transparent" />
              <Crown size={40} className="text-accent-primary drop-shadow-md relative z-10" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-brand tracking-widest uppercase mb-1">INNER</h2>
              <span className="text-brand-muted text-[11px] font-black uppercase tracking-[0.25em]">Exclusive Network v1.0.0</span>
            </div>
            <p className="text-brand-muted text-[14px] leading-relaxed max-w-[320px] font-medium">
              INNER נועדה להחזיר את האקסקלוסיביות לרשתות החברתיות. במקום רועש והמוני, יצרנו מרחב נקי שבו תוכן איכותי מקבל ערך אמיתי דרך חותמות, דרופים וכלכלת CRD שמבוססת על אמון ומוניטין.
            </p>
          </div>
        );

      case 'terms':
        return (
          <div className="flex flex-col gap-6 text-right py-2 text-brand-muted">
            <div className="flex justify-center mb-2"><Crown size={32} className="text-brand/20" /></div>
            <h3 className="text-2xl font-black text-brand text-center uppercase tracking-widest">תקנון ותנאי שימוש</h3>
            
            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black">1. מבוא והסכמה</h4>
              <p className="text-[13px] leading-relaxed">
                ברוכים הבאים לאפליקציית INNER (להלן: "האפליקציה" או "הפלטפורמה"), המופעלת על ידי הנהלת INNER (להלן: "החברה"). השימוש באפליקציה, לרבות כל התכנים, הכלכלה הווירטואלית והשירותים המוצעים בה, כפוף לתנאי שימוש אלה. בעצם הרשמתך לאפליקציה, הנך מצהיר כי קראת, הבנת והסכמת לכל תנאי התקנון במלואם.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black">2. הכלכלה הווירטואלית (מטבעות CRD)</h4>
              <p className="text-[13px] leading-relaxed">
                2.1 הפלטפורמה כוללת שימוש במטבעות וירטואליים פנימיים המכונים "CRD" (להלן: "המטבעות"). המטבעות נועדו לשימוש בלעדי בתוך האפליקציה בלבד (כגון: פתיחת דרופים, כניסה למועדונים ושליחת הודעות פרטיות).<br/><br/>
                2.2 <strong className="text-brand">אין ערך כספי מחוץ לאפליקציה:</strong> המטבעות אינם מהווים הילך חוקי, אינם ניתנים להמרה לכסף אמיתי (פיאט), ואין להם שום ערך מחוץ למערכת INNER.<br/><br/>
                2.3 <strong className="text-brand">העדר החזרים (No Refunds):</strong> כל רכישה של חבילות CRD או שירותי מנוי (כגון שדרוג ל-CORE) הינה סופית. החברה אינה מספקת החזרים כספיים (Refunds) בגין רכישות שבוצעו, למעט מקרים המחויבים על פי החוק בישראל.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black">3. מועדונים (Sanctums) ומוניטין (XP)</h4>
              <p className="text-[13px] leading-relaxed">
                המשתמשים רשאים לפתוח "מועדונים" ולגבות עליהם דמי כניסה ב-CRD או להגדיר חסמי כניסה מבוססי רמה (Level). החברה אינה אחראית לתוכן המפורסם בתוך מועדונים אלו. הנהלת המועדון מחויבת לשמור על חוקי המדינה ולמנוע תוכן פוגעני. החברה שומרת לעצמה את הזכות לסגור מועדונים שיפרו את כללי הקהילה, ללא החזר עלויות או מטבעות.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black">4. תוכן גולשים והתנהגות</h4>
              <p className="text-[13px] leading-relaxed">
                המשתמש נושא באחריות הבלעדית לכל תוכן (טקסט, תמונה, וידאו) שמועלה על ידו (להלן: "תוכן גולשים"). חל איסור מוחלט להעלות תוכן המפר זכויות יוצרים, תוכן פורנוגרפי, תוכן מסית לגזענות או לאלימות, או כל תוכן העובר על חוקי מדינת ישראל. החברה רשאית למחוק כל תוכן ולהשעות משתמשים בכל עת, על פי שיקול דעתה הבלעדי וללא הודעה מוקדמת.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black">5. קניין רוחני וזכויות החברה</h4>
              <p className="text-[13px] leading-relaxed">
                כל זכויות הקניין הרוחני באפליקציה, לרבות עיצוב, קוד, לוגואים, סימני מסחר והאלגוריתם שמאחורי הפלטפורמה, שייכים לחברה בלבד. אין להעתיק, לשכפל או להפיץ כל חלק מהאפליקציה ללא אישור בכתב.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black">6. הגבלת אחריות וסמכות שיפוט</h4>
              <p className="text-[13px] leading-relaxed">
                האפליקציה ניתנת לשימוש כמות שהיא (AS IS). החברה לא תהיה אחראית לכל נזק עקיף, תוצאתי, אובדן נתונים או פגיעה במוניטין שייגרמו כתוצאה משימוש באפליקציה. סמכות השיפוט הבלעדית בכל סכסוך הנוגע לשימוש באפליקציה מסורה לבתי המשפט המוסמכים במחוז תל אביב-יפו בלבד, ויוחלו עליו דיני מדינת ישראל.
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
              <h4 className="text-brand text-[15px] font-black">1. הגנה על המידע שלך</h4>
              <p className="text-[13px] leading-relaxed">
                אנו ב-INNER רואים חשיבות עליונה בשמירה על פרטיות המשתמשים שלנו. מדיניות זו נועדה לשקף בשקיפות מלאה איזה מידע נאסף, כיצד נעשה בו שימוש, וכיצד אנו מגנים עליו בהתאם לתקנות הגנת הפרטיות.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black">2. המידע הנאסף</h4>
              <p className="text-[13px] leading-relaxed">
                <strong className="text-brand">מידע שנמסר מיוזמתך:</strong> בעת ההרשמה אתה מספק פרטים כגון כתובת אימייל, שם מלא ושם משתמש. <br/>
                <strong className="text-brand">מידע אוטומטי:</strong> המערכת אוספת נתוני שימוש (לוגים, זמני התחברות, סוג מכשיר) לצורך אבטחת חשבונך ולשיפור זרימת האפליקציה.<br/>
                <strong className="text-brand">תוכן אישי:</strong> תמונות, פוסטים והודעות מוצפנים ונשמרים בשרתי החברה המאובטחים. התוכן במרחב "הדרופים" והמועדונים חשוף אך ורק למי שהורשה לכך על פי הגדרות הכלכלה הפנימית.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black">3. מטרת איסוף המידע</h4>
              <p className="text-[13px] leading-relaxed">
                איננו מוכרים את המידע האישי שלך לגורמים מסחריים (No Data Selling). המידע משמש אותנו בלבד כדי: לתפעל את מנגנון ה-XP וה-CRD, לספק שירות לקוחות, לאבטח את הפלטפורמה מפני הונאות, ולהתאים אישית את החוויה.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black">4. אבטחת מידע וזכות מחיקה</h4>
              <p className="text-[13px] leading-relaxed">
                אנו נוקטים באמצעי אבטחה מחמירים כדי להגן על שרתי הנתונים שלנו. עם זאת, אין מערכת חסינה לחלוטין. למשתמש עומדת הזכות לדרוש את מחיקת הנתונים שלו (Right to be forgotten). הפעלת מחיקת חשבון באפליקציה תביא למחיקת התוכן שלך משרתינו לצמיתות, מבלי יכולת שחזור.
              </p>
            </section>
            <div className="h-4" />
          </div>
        );

      case 'accessibility':
        return (
          <div className="flex flex-col gap-6 text-right py-2 text-brand-muted">
            <div className="flex justify-center mb-2"><Accessibility size={32} className="text-brand/30" /></div>
            <h3 className="text-2xl font-black text-brand text-center uppercase tracking-widest">הצהרת נגישות</h3>
            
            <section className="flex flex-col gap-2">
              <p className="text-[13px] leading-relaxed">
                חברת INNER פועלת ומקצה משאבים כדי להפוך את האפליקציה והשירותים הדיגיטליים שלה לנגישים עבור אנשים עם מוגבלויות, מתוך אמונה כי לכל אדם מגיעה הזכות לשוויון, כבוד ועצמאות במרחב הדיגיטלי.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black">התאמות הנגישות שבוצעו:</h4>
              <ul className="text-[13px] leading-relaxed list-disc list-inside px-4 space-y-1">
                <li>תמיכה במצב כהה (Dark Mode) המפחית עומס ויזואלי ומסייע לסובלים מרגישות לאור.</li>
                <li>שימוש בניגודיות צבעים (Contrast) גבוהה בטקסטים ובכפתורים המרכזיים.</li>
                <li>בניית רכיבי קוד תקינים המאפשרים קריאה חלקה על ידי קוראי מסך במובייל (VoiceOver / TalkBack).</li>
                <li>הגדלת אזורי הלחיצה (Touch Targets) כדי להקל על הניווט.</li>
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <h4 className="text-brand text-[15px] font-black">פניות בנושא נגישות</h4>
              <p className="text-[13px] leading-relaxed">
                אנו ממשיכים במאמצים לשפר את הנגישות כחלק ממחויבותנו לאפשר שימוש עבור כלל האוכלוסייה. אם נתקלתם בבעיית נגישות או שיש לכם הצעות לשיפור, אנא פנו אלינו בכתובת: <span className="text-accent-primary font-bold">support@inner-app.com</span>.
              </p>
            </section>
          </div>
        );

      case 'delete':
        return (
          <div className="flex flex-col items-center justify-center text-center gap-6 py-2">
            <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <AlertTriangle size={36} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-brand mb-2">אזהרת מחיקה לצמיתות</h3>
              <p className="text-brand-muted text-[14px] leading-relaxed px-4">
                פעולה זו <strong className="text-red-500">תמחק באופן בלתי הפיך</strong> את החשבון, ה-XP, המועדונים, הפוסטים ואת כל מאזן ה-CRD שלך. אי אפשר להתחרט.
              </p>
            </div>

            <div className="w-full bg-surface-card border border-red-500/30 rounded-[28px] p-5 flex flex-col gap-4 shadow-inner">
              <span className="text-brand-muted text-[11px] font-black uppercase tracking-widest">כדי לאשר, הקלד את קוד הביטחון</span>
              <div className="text-2xl font-black text-red-400 tracking-[0.4em] select-none bg-surface py-3 rounded-[16px] border border-surface-border">
                {deleteCode}
              </div>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
                placeholder="הקלד כאן..."
                dir="ltr"
                className="w-full h-14 bg-surface border border-surface-border rounded-[16px] text-center text-brand font-black text-lg tracking-widest focus:border-red-500 outline-none transition-all placeholder:text-brand-muted/40 placeholder:text-sm placeholder:tracking-normal"
              />
            </div>

            <Button
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteInput !== deleteCode}
              className="w-full h-14 bg-red-500 text-white font-black text-[14px] uppercase tracking-widest rounded-full shadow-[0_10px_30px_rgba(239,68,68,0.2)] transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:shadow-none flex items-center justify-center"
            >
              {isDeleting ? <Loader2 className="animate-spin text-white" /> : 'כן, מחק את החשבון שלי'}
            </Button>
          </div>
        );

      case 'contact':
        return (
          <div className="flex flex-col gap-5 items-center text-center py-6">
            <div className="w-20 h-20 rounded-[28px] bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
              <Mail size={32} className="text-accent-primary" />
            </div>
            <h3 className="text-2xl font-black text-brand">צוות התמיכה</h3>
            <p className="text-brand-muted text-[14px] leading-relaxed max-w-[320px]">
              זקוקים לעזרה עם פתיחת מועדון, רכישת CRD, או מחיקת נתונים? הצוות שלנו עומד לרשותכם ויחזור אליכם בהקדם האפשרי.
            </p>
            <Button
              onClick={handleSupportMail}
              className="mt-4 w-full h-14 bg-white text-black font-black uppercase tracking-widest rounded-full shadow-[0_5px_20px_rgba(255,255,255,0.15)] active:scale-95 transition-transform"
            >
              העתק כתובת תמיכה
            </Button>
          </div>
        );

      case 'linked':
      case 'blocked':
        return (
          <div className="flex flex-col gap-4 items-center text-center py-10 opacity-60">
            <div className="w-16 h-16 rounded-[24px] bg-surface border border-surface-border flex items-center justify-center">
              <Lock size={26} className="text-brand-muted" />
            </div>
            <h3 className="text-xl font-black text-brand">בקרוב</h3>
            <p className="text-brand-muted text-sm leading-relaxed max-w-[280px]">
              אפשרות זו תהיה זמינה בעדכון הגרסה הבא של INNER.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* 📄 MAIN SETTINGS PAGE */}
      <FadeIn className="px-4 pt-4 pb-[120px] flex flex-col gap-6 bg-surface min-h-screen font-sans relative" dir="rtl">
        
        {/* HEADER */}
        <div className="flex items-center justify-center relative mb-4">
          <h1 className="text-lg font-black text-brand tracking-widest uppercase">הגדרות</h1>
        </div>

        <div className="flex flex-col gap-8 relative z-10">
          {SETTINGS_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-3">
              <h3 className="text-brand-muted text-[11px] font-black px-3 tracking-widest uppercase text-right">
                {group.title}
              </h3>
              
              <div className="bg-surface-card border border-surface-border rounded-[32px] overflow-hidden flex flex-col shadow-sm">
                {group.items.map((item: any, iIdx) => (
                  <button
                    key={iIdx}
                    onClick={() => (item.key ? toggleSetting(item.key) : item.action?.())}
                    className={`flex items-center gap-4 p-4 text-right transition-all active:scale-[0.995] hover:bg-white/5 ${
                      iIdx !== group.items.length - 1 ? 'border-b border-surface-border' : ''
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-[20px] ${item.bg} border ${item.isDanger ? 'border-red-500/20' : 'border-white/5'} flex items-center justify-center shrink-0 shadow-inner`}>
                      <item.icon size={20} className={item.color} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className={`font-black text-[15px] ${item.isDanger ? 'text-red-500' : 'text-brand'}`}>
                        {item.label}
                      </div>
                      <div className="text-[11px] font-bold text-brand-muted mt-0.5 opacity-80 uppercase tracking-wide">
                        {item.desc}
                      </div>
                    </div>
                    
                    {item.key ? (
                      <div className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${settings[item.key as keyof typeof settings] ? 'bg-accent-primary/20 border border-accent-primary/40' : 'bg-surface border border-surface-border'}`}>
                        <div className={`w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${settings[item.key as keyof typeof settings] ? 'bg-accent-primary translate-x-[-24px]' : 'bg-brand-muted translate-x-0'}`} />
                      </div>
                    ) : (
                      <ChevronLeft size={18} className={`${item.isDanger ? 'text-red-400' : 'text-brand-muted'} transition-colors`} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Logout Button Main */}
        <div className="mt-4 relative z-10">
          <Button
            onClick={async () => {
              triggerFeedback('pop');
              await signOut();
              navigate('/auth');
            }}
            className="w-full h-14 bg-surface-card border border-surface-border text-brand font-black text-[14px] uppercase tracking-widest rounded-full flex items-center justify-center gap-2 shadow-sm hover:bg-white/5 transition-all active:scale-[0.98]"
          >
            <LogOut size={18} className="text-brand-muted" />
            התנתק מהמערכת
          </Button>
          <div className="text-center mt-6">
            <p className="text-[9px] font-black text-brand-muted/30 uppercase tracking-[0.4em]">INNER Exclusive Network © 2026</p>
          </div>
        </div>
      </FadeIn>

      {/* 📱 BOTTOM SHEETS (Sub-menus) */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeSheet && (
            <div className="fixed inset-0 z-[9999999] flex flex-col justify-end" dir="rtl" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeSheet} />
              
              <motion.div
                drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.22}
                onDragEnd={(e, info) => { if (info.offset.y > 100 || info.velocity.y > 500) closeSheet(); }}
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                className="relative z-10 bg-surface rounded-t-[40px] h-[85vh] flex flex-col overflow-hidden pb-10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] border-t border-surface-border"
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
