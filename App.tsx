
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

// Auth Context
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
  if (!profile) return <Navigate to="/setup" />;
  
  return <>{children}</>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.warn("Profile fetch restricted by rules:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Presence tracking logic with extreme safety
        try {
          const connectedRef = ref(rtdb, '.info/connected');
          const statusRef = ref(rtdb, `status/${u.uid}`);
          
          onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
              onDisconnect(statusRef).set({
                isOnline: false,
                lastSeen: serverTimestamp(),
              }).catch(() => {});

              set(statusRef, {
                isOnline: true,
                lastSeen: serverTimestamp(),
              }).catch(() => {});
            }
          });
        } catch (e) {
          console.warn("RTDB Presence tracking unavailable (check rules)");
        }

        // Sync to Firestore profile
        try {
          const firestoreRef = doc(db, 'users', u.uid);
          const snap = await getDoc(firestoreRef);
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
            // Non-blocking update
            updateDoc(firestoreRef, { isOnline: true, lastSeen: Date.now() }).catch(() => {});
          } else {
            setProfile(null);
          }
        } catch (firestoreErr) {
          console.warn("Firestore profile sync unavailable (check rules)");
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      <HashRouter>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
          <Toaster position="top-center" reverseOrder={false} />
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
            <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
            <Route path="/setup" element={user ? <ProfileSetupPage /> : <Navigate to="/login" />} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          </Routes>
        </div>
      </HashRouter>
    </AuthContext.Provider>
  );
};

export default App;
