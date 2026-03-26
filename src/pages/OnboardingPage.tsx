import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FadeIn } from '../components/ui';

type Slide = {
  eyebrow: string;
  title: string;
  desc: string;
};

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const slides: Slide[] = useMemo(
    () => [
      {
        eyebrow: 'LIVE FIRST',
        title: 'ברוכים הבאים ל־INNER',
        desc: 'INNER היא אפליקציית מעגלים פנימיים. כאן נכנסים לקהילות סגורות, מרגישים פעילות חיה, ונמצאים במקום שלא מרגיש כמו עוד פיד רגיל.'
      },
      {
        eyebrow: 'ACCESS',
        title: 'גישה לפני הכול',
        desc: 'ב־INNER לא רק צופים. נכנסים למעגל, מקבלים גישה, פותחים דרופים, ונמצאים במקום שלא כולם יכולים לראות.'
      },
      {
        eyebrow: 'STATUS',
        title: 'כאן רואים אותך',
        desc: 'OG, CORE, Top Supporter, Level ו־Streak. הסטטוס שלך הוא חלק מהחוויה, ומי שפועל יותר — בולט יותר.'
      },
      {
        eyebrow: 'FOMO',
        title: 'הכול קורה עכשיו',
        desc: 'צ׳אט בזמן אמת, gifts, הודעות מודגשות ותחושת FOMO אמיתית. ברגע שנכנסים — מבינים את הוייב.'
      }
    ],
    []
  );

  const current = slides[step];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }

    localStorage.setItem('inner_circles_onboarded', 'true');
    navigate('/feed', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[18%] left-[12%] w-72 h-72 bg-white/[0.03] blur-[110px] rounded-full" />
        <div className="absolute bottom-[10%] right-[10%] w-80 h-80 bg-[#d6b38a]/[0.05] blur-[130px] rounded-full" />
      </div>

      <FadeIn key={step} className="relative z-10 w-full max-w-sm text-center">
        <div className="flex flex-col items-center">
          <h1 className="text-[58px] font-black tracking-[-0.08em] text-white italic select-none">
            INNER
          </h1>

          <div className="mt-10 px-4">
            <div className="text-white/35 text-[11px] tracking-[0.34em] uppercase font-bold">
              {current.eyebrow}
            </div>

            <h2 className="mt-5 text-white text-[30px] leading-[1.05] font-black tracking-tight">
              {current.title}
            </h2>

            <p className="mt-5 text-white/50 text-[15px] leading-7 font-bold">
              {current.desc}
            </p>
          </div>

          <div className="flex items-center gap-2 mt-10">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === step ? 'w-8 bg-white' : 'w-2 bg-white/20'
                }`}
              />
            ))}
          </div>

          <Button
            onClick={handleNext}
            className="w-full h-14 mt-12 bg-white/15 text-white border border-white/10"
          >
            {step === slides.length - 1 ? 'כניסה' : 'המשך'}
          </Button>
        </div>
      </FadeIn>
    </div>
  );
};
