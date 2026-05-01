import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { calcScore, type PromotionData } from '../lib/promotionScore';
import StatCard from '../components/StatCard';

interface Profile {
  rank: string | null;
  first_name: string | null;
  last_name: string | null;
  unit: string | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile]             = useState<Profile | null>(null);
  const [soldierCount, setSoldierCount]   = useState(0);
  const [counselingCount, setCounselingCount] = useState(0);
  const [promoReady, setPromoReady]       = useState<{ green: number; total: number } | null>(null);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, soldiersRes, counselingsRes, promoRes] = await Promise.all([
        supabase.from('profiles').select('rank, first_name, last_name, unit').eq('id', user.id).single(),
        supabase.from('soldiers').select('id', { count: 'exact' }).eq('nco_id', user.id),
        supabase.from('counselings')
          .select('id', { count: 'exact' })
          .eq('nco_id', user.id)
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from('promotion_data').select('*').eq('nco_id', user.id),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setSoldierCount(soldiersRes.count ?? 0);
      setCounselingCount(counselingsRes.count ?? 0);

      if (promoRes.data && promoRes.data.length > 0) {
        const assessed = promoRes.data as PromotionData[];
        const green = assessed.filter(p => calcScore({ ...p, custom_points: p.custom_points ?? [] }).status === 'GREEN').length;
        setPromoReady({ green, total: assessed.length });
      }

      setLoading(false);
    };
    load();
  }, []);

  const displayName = profile
    ? [profile.rank, profile.last_name].filter(Boolean).join(' ') || 'Soldier'
    : '...';

  const promoStat = promoReady
    ? `${promoReady.green}/${promoReady.total}`
    : '—';

  const promoSub = promoReady
    ? `${promoReady.green} of ${promoReady.total} assessed GREEN`
    : 'No assessments yet';

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
        </div>
        <h1 className="text-2xl font-bold text-army-text">
          Welcome back, <span className="text-army-gold">{loading ? '...' : displayName}</span>
        </h1>
        {profile?.unit && (
          <div className="font-mono text-xs text-army-muted mt-1">{profile.unit}</div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Soldiers Managed"
          value={loading ? '—' : soldierCount}
          sub="Active roster"
        />
        <StatCard
          label="Counselings This Month"
          value={loading ? '—' : counselingCount}
          sub={new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        />
        <StatCard
          label="Promotion Readiness"
          value={loading ? '—' : promoStat}
          sub={loading ? '' : promoSub}
          accent
        />
      </div>

      {/* Quick Actions */}
      <div className="border-t border-border pt-6">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-4">Quick Actions</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/counseling/new')}
            className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-sm tracking-wider py-4 px-6 transition-colors text-left"
          >
            <div className="text-lg mb-1">◈</div>
            Start Counseling
          </button>
          <button
            onClick={() => navigate('/soldiers')}
            className="bg-surface border border-border hover:border-army-tan text-army-text font-mono text-sm tracking-wider py-4 px-6 transition-colors text-left"
          >
            <div className="text-lg mb-1">◉</div>
            Add Soldier
          </button>
          <button
            onClick={() => navigate('/ask-sgm')}
            className="bg-surface border border-border hover:border-army-tan text-army-text font-mono text-sm tracking-wider py-4 px-6 transition-colors text-left"
          >
            <div className="text-lg mb-1">◇</div>
            Ask the SGM
          </button>
        </div>
      </div>

      {/* Profile incomplete banner */}
      {!loading && profile && !profile.first_name && (
        <div className="mt-6 bg-[#1a1400] border border-army-gold px-4 py-3 flex items-center justify-between">
          <div className="font-mono text-xs text-army-gold">
            Complete your profile — add your rank, name, and unit so the platform knows who you are.
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="font-mono text-xs text-army-gold border border-army-gold px-3 py-1 hover:bg-army-gold hover:text-bg transition-colors flex-shrink-0 ml-4"
          >
            UPDATE
          </button>
        </div>
      )}
    </div>
  );
}
