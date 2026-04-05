import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <div className={cn("bg-surface-card border border-surface-border rounded-[32px] shadow-2xl backdrop-blur-3xl p-5", className)}>
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
    className={cn("w-full border border-surface-border bg-white/[0.03] backdrop-blur-2xl text-white rounded-2xl px-4 py-3.5 outline-none placeholder:text-white/30 focus:border-white/20 transition-colors shadow-inner", className)}
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
          "flex items-center justify-center gap-2 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-60 disabled:pointer-events-none shadow-xl",
          size === 'default' ? "py-3.5 px-4 text-[15px]" : "py-2.5 px-3.5 text-sm rounded-xl",
          variant === 'primary' && "bg-white/[0.08] text-white border border-white/10 backdrop-blur-3xl hover:bg-white/[0.12]",
          variant === 'secondary' && "bg-white/[0.03] text-white border border-white/5 backdrop-blur-xl hover:bg-white/[0.06]",
          variant === 'ghost' && "bg-transparent text-white/60 hover:text-white hover:bg-white/[0.05] shadow-none backdrop-blur-sm",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
