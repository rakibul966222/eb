
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { auth, db, rtdb } from './firebase';
import { UserProfile } from './types';
import { Toaster } from 'react-hot-toast';

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

// Fix: Explicitly define the props to include children using React.PropsWithChildren for React 18 compatibility.
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
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setProfile(docSnap.data() as UserProfile);
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Presence tracking logic
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
          }
        });

        // Sync to Firestore status for simpler querying if needed
        const firestoreRef = doc(db, 'users', u.uid);
        const snap = await getDoc(firestoreRef);
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
          await updateDoc(firestoreRef, { isOnline: true, lastSeen: Date.now() });
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
        <div className="min-h-screen bg-slate-50">
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
