
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { auth } from '../firebase';
import { ArrowLeft, User, Shield, Bell, Trash2, LogOut, Moon, Sun, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

const SettingsPage: React.FC = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleDeleteAccount = async () => {
    if (window.confirm("Warning: This will permanently delete your account and all messages. Proceed?")) {
       try {
         if (!user) return;
         await deleteDoc(doc(db, 'users', user.uid));
         await user.delete();
         toast.success("Account deleted.");
         navigate('/login');
       } catch (e: any) {
         toast.error(e.message);
       }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/')} className="p-2 bg-white dark:bg-slate-800 dark:text-white rounded-full shadow-sm hover:bg-slate-100">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border dark:border-slate-700">
             <div className="flex items-center gap-4 mb-6">
               <img src={profile?.photoURL} className="w-20 h-20 rounded-full object-cover border-4 border-slate-100 dark:border-slate-700" />
               <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">{profile?.name}</h2>
                  <p className="text-slate-500">{profile?.email}</p>
               </div>
               <button onClick={() => navigate('/setup')} className="ml-auto px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg">
                 Edit
               </button>
             </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border dark:border-slate-700">
             <h3 className="px-2 mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Appearance</h3>
             <button 
               onClick={() => setDarkMode(!darkMode)}
               className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group"
             >
                <div className="flex items-center gap-3">
                   {darkMode ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-slate-400" />}
                   <span className="text-slate-700 dark:text-slate-200">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                   <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`}></div>
                </div>
             </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border dark:border-slate-700">
             <h3 className="px-2 mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Account Control</h3>
             <div className="space-y-1">
                <button onClick={handleDeleteAccount} className="w-full flex items-center gap-3 p-3 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                   <Trash2 size={20} />
                   <span>Delete Account</span>
                </button>
                <button onClick={() => auth.signOut()} className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                   <LogOut size={20} />
                   <span>Log Out</span>
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
