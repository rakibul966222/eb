
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { auth, db, rtdb } from './firebase';
import { UserProfile } from './types';
import { Toaster, toast } from 'react-hot-toast';

// Pages & Components
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import SettingsPage from './pages/SettingsPage';
import LoadingScreen from './components/LoadingScreen';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const ProtectedRoute: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (user && !profile) return <Navigate to="/setup" />;
  
  return <>{children}</>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Profile refresh error", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u);
      
      if (u) {
        // Presence tracking (RTDB)
        const statusRef = ref(rtdb, `status/${u.uid}`);
        const connectedRef = ref(rtdb, '.info/connected');
        
        onValue(connectedRef, (snap) => {
          if (snap.val() === true) {
            onDisconnect(statusRef).set({
              isOnline: false,
              lastSeen: serverTimestamp(),
            });
            set(statusRef, {
              isOnline: true,
              lastSeen: serverTimestamp(),
            });

            // Also update Firestore when coming online
            const docRef = doc(db, 'users', u.uid);
            updateDoc(docRef, { isOnline: true, lastSeen: Date.now() }).catch(() => {});
          }
        });

        // Check profile
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      <HashRouter>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors selection:bg-indigo-500/30">
          <Toaster position="top-center" reverseOrder={false} />
          <Routes>
            <Route path="/login" element={user && profile ? <Navigate to="/" /> : <LoginPage />} />
            <Route path="/register" element={user && profile ? <Navigate to="/" /> : <RegisterPage />} />
            <Route path="/setup" element={user && profile ? <Navigate to="/" /> : (user ? <ProfileSetupPage /> : <Navigate to="/login" />)} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          </Routes>
        </div>
      </HashRouter>
    </AuthContext.Provider>
  );
};

export default App;
