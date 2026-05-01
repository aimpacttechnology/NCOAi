import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Soldiers from './pages/Soldiers';
import SoldierDetail from './pages/SoldierDetail';
import CounselingWizard from './pages/CounselingWizard';
import AskSGM from './pages/AskSGM';
import NCOERGenerator from './pages/NCOERGenerator';
import PromotionReadiness from './pages/PromotionReadiness';
import Profile from './pages/Profile';
import MentorshipWizard from './pages/MentorshipWizard';
import DevelopmentPlans from './pages/DevelopmentPlans';
import WisdomJournal from './pages/WisdomJournal';

function Protected({ user, children }: { user: User | null; children: React.ReactNode }) {
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <span className="font-mono text-army-gold tracking-widest animate-pulse">LOADING...</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={<Protected user={user}><Dashboard /></Protected>} />
        <Route path="/soldiers" element={<Protected user={user}><Soldiers /></Protected>} />
        <Route path="/soldiers/:id" element={<Protected user={user}><SoldierDetail /></Protected>} />
        <Route path="/counseling/new" element={<Protected user={user}><CounselingWizard /></Protected>} />
        <Route path="/ask-sgm" element={<Protected user={user}><AskSGM /></Protected>} />
        <Route path="/ncoer" element={<Protected user={user}><NCOERGenerator /></Protected>} />
        <Route path="/promotion" element={<Protected user={user}><PromotionReadiness /></Protected>} />
        <Route path="/profile" element={<Protected user={user}><Profile /></Protected>} />
        <Route path="/mentorship" element={<Protected user={user}><MentorshipWizard /></Protected>} />
        <Route path="/plans" element={<Protected user={user}><DevelopmentPlans /></Protected>} />
        <Route path="/journal" element={<Protected user={user}><WisdomJournal /></Protected>} />
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
