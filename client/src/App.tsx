import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import TermsGate from './pages/TermsGate';
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
import Tasks from './pages/Tasks';
import UnitGapAnalysis from './pages/UnitGapAnalysis';
import AwardWizard from './pages/AwardWizard';
import TrainingPlanner from './pages/TrainingPlanner';
import DocLibrary from './pages/DocLibrary';

function Protected({ user, children }: { user: User | null; children: React.ReactNode }) {
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const [user, setUser]             = useState<User | null>(null);
  const [termsAccepted, setTerms]   = useState(false);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const checkTerms = async (uid: string) => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('terms_accepted_at')
          .eq('id', uid)
          .single();
        setTerms(!!data?.terms_accepted_at);
      } catch {
        setTerms(false);
      }
    };

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const u = session?.user ?? null;
        setUser(u);
        if (u) await checkTerms(u.id);
      } catch {
        // leave user null, loading will end
      } finally {
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await checkTerms(u.id);
      else setTerms(false);
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

  // Logged in but hasn't accepted terms yet
  if (user && !termsAccepted) {
    return <TermsGate userId={user.id} onAccepted={() => setTerms(true)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard"      element={<Protected user={user}><Dashboard /></Protected>} />
        <Route path="/soldiers"       element={<Protected user={user}><Soldiers /></Protected>} />
        <Route path="/soldiers/:id"   element={<Protected user={user}><SoldierDetail /></Protected>} />
        <Route path="/counseling/new" element={<Protected user={user}><CounselingWizard /></Protected>} />
        <Route path="/ask-sgm"        element={<Protected user={user}><AskSGM /></Protected>} />
        <Route path="/ncoer"          element={<Protected user={user}><NCOERGenerator /></Protected>} />
        <Route path="/promotion"      element={<Protected user={user}><PromotionReadiness /></Protected>} />
        <Route path="/profile"        element={<Protected user={user}><Profile /></Protected>} />
        <Route path="/mentorship"     element={<Protected user={user}><MentorshipWizard /></Protected>} />
        <Route path="/plans"          element={<Protected user={user}><DevelopmentPlans /></Protected>} />
        <Route path="/journal"        element={<Protected user={user}><WisdomJournal /></Protected>} />
        <Route path="/tasks"          element={<Protected user={user}><Tasks /></Protected>} />
        <Route path="/unit-gaps"      element={<Protected user={user}><UnitGapAnalysis /></Protected>} />
        <Route path="/awards"         element={<Protected user={user}><AwardWizard /></Protected>} />
        <Route path="/training"       element={<Protected user={user}><TrainingPlanner /></Protected>} />
        <Route path="/library"        element={<Protected user={user}><DocLibrary /></Protected>} />
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
