import React from 'react';
import { motion } from 'framer-motion';

export const GlassCard = ({ children, className = '', onClick }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: onClick ? 0.98 : 1 }}
    whileTap={{ scale: onClick ? 0.96 : 1 }}
    onClick={onClick}
    className={`backdrop-blur-xl bg-white/[0.04] border border-white/10 shadow-2xl ${className}`}
  >
    {children}
  </motion.div>
);

export const FadeIn = ({ children, className = '', delay = 0, dir = 'rtl' }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={className}
    dir={dir}
  >
    {children}
  </motion.div>
);

export const Button = ({ children, onClick, className = '', disabled }: any) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    whileHover={{ scale: 1.02 }}
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-2 font-black transition-all disabled:opacity-50 ${className}`}
  >
    {children}
  </motion.button>
);

export const Input = (props: any) => (
  <input 
    {...props} 
    className={`w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-4 text-white text-sm font-black placeholder:text-white/20 focus:border-white/30 transition-all shadow-inner outline-none ${props.className || ''}`} 
  />
);
