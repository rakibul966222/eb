
import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { UserPlus, Mail, Lock, Sparkles, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error("Passwords don't match");
    }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast.success('Account created! Please set up your profile.');
      navigate('/setup');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[#f8fafc] dark:bg-slate-950 relative overflow-hidden">
      {/* Background decoration matching LoginPage */}
      <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-indigo-500/10 blur-[150px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-10 rounded-[40px] shadow-2xl border border-white dark:border-slate-800 z-10"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ rotate: -15 }}
            animate={{ rotate: 0 }}
            className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/30 text-white"
          >
            <UserPlus size={40} />
          </motion.div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Register</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Create your AI-powered identity</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input
              type="email"
              placeholder="Email address"
              className="w-full pl-12 pr-4 py-4 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl outline-none transition-all font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="relative group">
            <Lock className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input
              type="password"
              placeholder="Secure Password"
              className="w-full pl-12 pr-4 py-4 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl outline-none transition-all font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="relative group">
            <ShieldCheck className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input
              type="password"
              placeholder="Confirm Password"
              className="w-full pl-12 pr-4 py-4 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl outline-none transition-all font-medium"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/30 disabled:opacity-50 mt-4"
          >
            {loading ? 'Creating Identity...' : 'Register Account'}
          </motion.button>
        </form>

        <p className="mt-10 text-center text-slate-500 font-medium">
          Already verified?{' '}
          <Link to="/login" className="text-indigo-600 font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
