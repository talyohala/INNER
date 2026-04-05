import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <div className={cn("bg-white/10 backdrop-blur-[40px] border border-white/20 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_10px_40px_rgba(0,0,0,0.3)] rounded-[32px] p-5", className)}>
      {children}
    </div>
  );
};

export const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; className?: string; dir?: string }> = ({ children, delay = 0, className, dir }) => {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay }} dir={dir}>
      {children}
    </motion.div>
  );
};

export const PageTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <header className="flex items-center h-10 mt-3 mb-5 pr-1">
    <h1 className="text-2xl font-bold text-white tracking-tight">
      {children}
    </h1>
  </header>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("w-full bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] text-white rounded-2xl px-4 py-3.5 outline-none placeholder:text-white/60 focus:border-white/50 focus:bg-white/15 transition-all", className)}
    {...props}
  />
));
Input.displayName = 'Input';

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost', size?: 'default' | 'sm' }>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-2 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none",
          size === 'default' ? "py-3.5 px-4 text-[15px]" : "py-2.5 px-3.5 text-sm rounded-xl",
          variant === 'primary' && "bg-white/20 backdrop-blur-3xl border border-white/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_8px_20px_rgba(0,0,0,0.2)] text-white hover:bg-white/30",
          variant === 'secondary' && "bg-white/5 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] text-white hover:bg-white/10",
          variant === 'ghost' && "bg-transparent text-white/70 hover:text-white hover:bg-white/10 shadow-none backdrop-blur-sm",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
