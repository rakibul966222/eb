
import React, { useState } from 'react';
import { useAuth } from '../App';
import { db, storage } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import { Camera, Save, User, Calendar, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

const ProfileSetupPage: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [bio, setBio] = useState('');
  const [dob, setDob] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>(user?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user?.uid);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    
    let photoURL = preview;

    try {
      // Step 1: Attempt Storage Upload
      if (image) {
        try {
          const storageRef = ref(storage, `profiles/${user.uid}`);
          await uploadBytes(storageRef, image);
          photoURL = await getDownloadURL(storageRef);
        } catch (storageErr: any) {
          console.error("Storage Permission Error:", storageErr);
          toast.error("Avatar upload failed. Check Firebase Storage rules.");
          setLoading(false);
          return;
        }
      }

      // Step 2: Attempt Firestore Write
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name,
          email: user.email,
          dob,
          bio,
          photoURL,
          lastSeen: Date.now(),
          isOnline: true,
          createdAt: Date.now(),
        });
      } catch (firestoreErr: any) {
        console.error("Firestore Permission Error:", firestoreErr);
        toast.error("Profile save failed. Check Firestore Security Rules.");
        setLoading(false);
        return;
      }

      await refreshProfile();
      toast.success('System Initialized!');
      navigate('/');
    } catch (generalErr: any) {
      toast.error("Setup failed: " + (generalErr.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[#f8fafc] dark:bg-slate-950 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-indigo-500/10 blur-[150px] rounded-full"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-10 rounded-[40px] shadow-2xl border border-white dark:border-slate-800 z-10"
      >
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight text-center">Setup Profile</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Finalize your system profile</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col items-center">
            <div className="relative group">
              <img 
                src={preview} 
                alt="Profile" 
                className="w-32 h-32 rounded-[40px] object-cover border-4 border-white dark:border-slate-800 shadow-xl transition-all group-hover:scale-105"
              />
              <label className="absolute -bottom-2 -right-2 bg-indigo-600 p-3 rounded-2xl text-white cursor-pointer shadow-lg hover:bg-indigo-700 transition-all hover:scale-110">
                <Camera size={20} />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              </label>
            </div>
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-4">Avatar Uplink</p>
          </div>

          <div className="space-y-4">
            <div className="relative group">
              <User className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input
                type="text"
                placeholder="Full Name"
                className="w-full pl-12 pr-4 py-4 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl outline-none transition-all font-medium"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="relative group">
              <Calendar className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <input
                type="date"
                className="w-full pl-12 pr-4 py-4 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl outline-none transition-all font-medium"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>

            <div className="relative group">
              <FileText className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
              <textarea
                placeholder="Short bio..."
                rows={3}
                className="w-full pl-12 pr-4 py-4 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 rounded-2xl outline-none transition-all font-medium resize-none"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              ></textarea>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Processing...' : <><Save size={20} /> Save & Enter Chat</>}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default ProfileSetupPage;
