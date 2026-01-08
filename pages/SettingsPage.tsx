
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { auth } from '../firebase';
import { updatePassword } from 'firebase/auth';
import { ArrowLeft, Shield, LogOut, Moon, Sun, Eye, HardDrive, Lock, Key, Info, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const SettingsPage: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const updateSetting = async (key: string, value: any) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { [`settings.${key}`]: value });
      await refreshProfile();
      toast.success("Settings Updated");
    } catch (e) { toast.error("Cloud Error"); }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("Key must be 6+ chars");
    if (!auth.currentUser) return;
    setPasswordLoading(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success("Access Key Updated!");
      setNewPassword('');
      setShowPasswordForm(false);
    } catch (error: any) {
      toast.error(error.message.includes('recent-login') ? "Login again to change key" : error.message);
    } finally { setPasswordLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 overflow-y-auto custom-scrollbar transition-colors">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-6 mb-12">
          <button onClick={() => navigate('/')} className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white hover:scale-110 transition-all">
            <ArrowLeft size={24} />
          </button>
          <div>
             <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">NODE CONTROL</h1>
             <p className="text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-[0.3em]">Management Console</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20">
          <div className="md:col-span-1 space-y-4">
             <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 text-center border border-slate-200 dark:border-slate-800 shadow-xl">
               <div className="relative inline-block mb-6">
                <img src={profile?.photoURL} className="w-28 h-28 rounded-[36px] object-cover mx-auto border-4 border-slate-50 dark:border-slate-700 shadow-lg" alt="Avatar" />
                <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-md border-2 border-white dark:border-slate-900"><Shield size={16} fill="currentColor" /></div>
               </div>
               <h3 className="font-black text-slate-900 dark:text-white text-lg">{profile?.name}</h3>
               <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-2 bg-indigo-50 dark:bg-indigo-500/10 py-1.5 px-4 rounded-full inline-block">Authorized Node</p>
             </div>
             <button onClick={() => navigate('/setup')} className="w-full p-5 bg-indigo-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95">Edit Profile</button>
          </div>

          <div className="md:col-span-2 space-y-8">
            <section className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-4">About Developer</h3>
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <div className="flex items-start gap-6 mb-6">
                  <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center flex-shrink-0"><Info size={32} /></div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white">Rakibul</h4>
                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Architect & Developer</p>
                  </div>
                </div>
                <div className="space-y-4 text-sm font-medium leading-relaxed">
                  <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    Hello! I am Rakibul, a dedicated developer passionate about secure ecosystems. This platform provides seamless real-time connectivity with advanced security.
                  </div>
                  <div className="p-5 bg-indigo-50 dark:bg-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 text-indigo-900 dark:text-indigo-300">
                    হ্যালো! আমি রাকিবুল, একজন ডেভেলপার যিনি নিরাপদ যোগাযোগ ব্যবস্থা তৈরিতে আগ্রহী। এই প্ল্যাটফর্মটি উন্নত নিরাপত্তা সহ নিরবচ্ছিন্ন সংযোগ প্রদানের জন্য ডিজাইন করা হয়েছে।
                  </div>
                </div>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a href="https://wa.me/8801941429881" className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 rounded-2xl border border-green-100 dark:border-green-500/20 font-black text-[10px] uppercase tracking-widest"><Phone size={16} /> 01941429881</a>
                  <a href="mailto:mr442539@gmail.com" className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-500/20 font-black text-[10px] uppercase tracking-widest"><Mail size={16} /> mr442539@gmail.com</a>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-4">Security</h3>
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-2xl"><Eye size={20} /></div>
                    <div>
                      <p className="font-black text-sm text-slate-900 dark:text-white">Broadcast Status</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium italic">Visible to all</p>
                    </div>
                  </div>
                  <button onClick={() => updateSetting('showOnlineStatus', !profile?.settings?.showOnlineStatus)} className={`w-14 h-7 rounded-full relative transition-all ${profile?.settings?.showOnlineStatus ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <div className={`absolute top-1.5 w-4 h-4 bg-white rounded-full transition-all ${profile?.settings?.showOnlineStatus ? 'right-1.5' : 'left-1.5'}`}></div>
                  </button>
                </div>
                <div className="p-6">
                  <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="w-full flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-50 dark:bg-purple-500/10 text-purple-600 rounded-2xl"><Lock size={20} /></div>
                      <div><p className="font-black text-sm text-slate-900 dark:text-white">Access Key</p><p className="text-xs text-slate-500 dark:text-slate-400 font-medium italic">Update password</p></div>
                    </div>
                    <Key size={18} className="text-indigo-600" />
                  </button>
                  <AnimatePresence>
                    {showPasswordForm && (
                      <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={handlePasswordChange} className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                        <input type="password" placeholder="New Key" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-2xl outline-none font-bold text-slate-900 dark:text-white" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                        <button type="submit" disabled={passwordLoading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">{passwordLoading ? 'Encrypting...' : 'Update Key'}</button>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-4">Preferences</h3>
              <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <button onClick={() => setDarkMode(!darkMode)} className="w-full p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                   <div className="flex items-center gap-4">
                     <div className="p-3 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 rounded-2xl">{darkMode ? <Sun size={20} fill="currentColor" /> : <Moon size={20} fill="currentColor" />}</div>
                     <p className="font-black text-sm text-slate-900 dark:text-white">{darkMode ? 'Aether Mode' : 'Shadow Mode'}</p>
                   </div>
                   <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{darkMode ? 'LIGHT' : 'DARK'}</span>
                </button>
                <button onClick={() => auth.signOut()} className="w-full p-6 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-500/10 group">
                   <div className="flex items-center gap-4">
                     <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-2xl group-hover:scale-110 transition-transform"><LogOut size={20} /></div>
                     <p className="font-black text-sm text-slate-600 dark:text-slate-400 group-hover:text-red-600">Logout</p>
                   </div>
                   <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">LOGOUT</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
