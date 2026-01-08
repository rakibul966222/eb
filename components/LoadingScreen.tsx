
import React from 'react';
import { motion } from 'framer-motion';

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 z-50">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 90, 180, 270, 360],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "linear"
          }}
          className="w-20 h-20 border-t-4 border-r-4 border-indigo-600 rounded-[32px] relative z-10"
        />
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 text-center"
      >
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">EB</h2>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">Connecting to Secure Matrix...</p>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
