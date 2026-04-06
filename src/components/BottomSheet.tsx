import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import React, { useEffect, useRef } from 'react';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: string;
};

export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  children,
  height = '88vh',
}) => {
  const y = useMotionValue(0);
  const ySmooth = useSpring(y, {
    stiffness: 520,
    damping: 38,
    mass: 0.6,
  });

  const startY = useRef(0);
  const dragging = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
  }, [open]);

  const onStart = (e: any) => {
    startY.current = e.touches[0].clientY;
    dragging.current = false;
  };

  const onMove = (e: any) => {
    const delta = e.touches[0].clientY - startY.current;
    const isTop = !scrollRef.current || scrollRef.current.scrollTop <= 0;

    if (!dragging.current) {
      if (delta > 5 && isTop) dragging.current = true;
      else return;
    }

    y.set(Math.max(0, delta));
    e.preventDefault();
  };

  const onEnd = () => {
    if (!dragging.current) return;

    if (y.get() > 120) {
      y.set(window.innerHeight);
      setTimeout(onClose, 150);
    } else {
      y.set(0);
    }

    dragging.current = false;
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end" dir="rtl">

          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            style={{ y: ySmooth }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 520, damping: 38 }}
            className="bg-white rounded-t-[36px] flex flex-col overflow-hidden border-t border-black/10"
            style={{ height }}
            onTouchStart={onStart}
            onTouchMove={onMove}
            onTouchEnd={onEnd}
          >
            <div className="w-full py-4 flex justify-center">
              <div className="w-14 h-1.5 bg-black/10 rounded-full" />
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 pb-10"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {children}
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
