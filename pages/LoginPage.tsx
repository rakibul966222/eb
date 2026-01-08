
import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Mail, Lock, Chrome, Zap, ShieldQuestion } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EBLogo = ({ className }: { className?: string }) => (
  <div className={`relative flex items-center justify-center ${className}`}>
    <div className="absolute inset-0 bg-indigo-600 rounded-[28px] blur-2xl opacity-20 animate-pulse"></div>
    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 w-full h-full rounded-[28px] flex items-center justify-center shadow-2xl shadow-indigo-500/40 text-white border border-white/20">
      <svg viewBox="0 0 24 24" className="w-10 h-10 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 5h11v2H6v3h8v2H6v3h9v2H4V5zM16 5h3c1.1 0 2 .9 2 2v3.5c0 .83-.67 1.5-1.5 1.5.83 0 1.5.67 1.5 1.5V17c0 1.1-.9 2-2 2h-3V5zm2 7h1V7h-1v5zm0 5h1v-3.5h-1V17z" />
      </svg>
    </div>
  </div>
);

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('System Uplink Established');
      navigate('/');
    } catch (error: any) {
      toast.error("Access Denied: Invalid System Key");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Enter your system email first");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Recovery link sent to your email!");
    } catch (error: any) {
      toast.error("Reset failed: " + (error.message.includes('user-not-found') ? "Identity not found" : "Try again later"));
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Welcome back to EB!');
      navigate('/');
    } catch (error: any) {
      toast.error("Auth Interrupted");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[#f8fafc] dark:bg-slate-950 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 blur-[180px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl p-10 rounded-[48px] shadow-2xl border border-white/50 dark:border-slate-800/50 z-10"
      >
        <div className="text-center mb-10">
          <EBLogo className="w-20 h-20 mx-auto mb-6" />
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">EB CHAT</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-black text-[10px] uppercase tracking-[0.4em]">Advanced Communication Node</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input type="email" placeholder="System ID (Email)" className="w-full pl-12 pr-4 py-4 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-indigo-500 rounded-[24px] outline-none transition-all font-bold placeholder:text-slate-400" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input type="password" placeholder="Access Key" className="w-full pl-12 pr-4 py-4 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-indigo-500 rounded-[24px] outline-none transition-all font-bold placeholder:text-slate-400" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div className="flex justify-end px-2">
            <button 
              type="button" 
              onClick={handleForgotPassword}
              className="text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest transition-colors flex items-center gap-1.5"
            >
              <ShieldQuestion size={14} />
              {resetLoading ? 'Checking...' : 'Forgot Access Key?'}
            </button>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-[24px] transition-all shadow-xl shadow-indigo-500/30 disabled:opacity-50 mt-2 text-lg uppercase tracking-widest">{loading ? 'Verifying...' : 'Authorize Access'}</button>
        </form>

        <div className="relative my-10">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-slate-800"></div></div>
          <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em]"><span className="bg-white/10 dark:bg-transparent px-4 text-slate-400">External Gateway</span></div>
        </div>

        <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-white font-bold py-4 rounded-[24px] transition-all shadow-sm">
          <Chrome size={20} className="text-red-500" /> Google Auth
        </button>

        <p className="mt-10 text-center text-slate-500 font-bold text-sm uppercase tracking-widest">New Identity? <Link to="/register" className="text-indigo-600 font-black hover:underline underline-offset-4">REGISTER</Link></p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
