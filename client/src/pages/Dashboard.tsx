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

interface ComplianceAlert {
  soldier_id: string;
  name: string;
  rank: string;
  status: 'initial_overdue' | 'initial_due_soon' | 'quarterly_overdue' | 'quarterly_due_soon';
  days: number;
}

function daysBetween(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile]                   = useState<Profile | null>(null);
  const [soldierCount, setSoldierCount]         = useState(0);
  const [counselingCount, setCounselingCount]   = useState(0);
  const [promoReady, setPromoReady]             = useState<{ green: number; total: number } | null>(null);
  const [alerts, setAlerts]                     = useState<ComplianceAlert[]>([]);
  const [loading, setLoading]                   = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, soldiersRes, counselingsRes, promoRes, allCounselingsRes] = await Promise.all([
        supabase.from('profiles').select('rank, first_name, last_name, unit').eq('id', user.id).single(),
        supabase.from('soldiers').select('id, first_name, last_name, rank, created_at').eq('nco_id', user.id),
        supabase.from('counselings')
          .select('id', { count: 'exact' })
          .eq('nco_id', user.id)
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from('promotion_data').select('*').eq('nco_id', user.id),
        supabase.from('counselings')
          .select('soldier_id, created_at')
          .eq('nco_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      setSoldierCount(soldiersRes.count ?? 0);
      setCounselingCount(counselingsRes.count ?? 0);

      if (promoRes.data && promoRes.data.length > 0) {
        const assessed = promoRes.data as PromotionData[];
        const green = assessed.filter(p => calcScore({ ...p, custom_points: p.custom_points ?? [] }).status === 'GREEN').length;
        setPromoReady({ green, total: assessed.length });
      }

      // Build compliance alerts
      const soldiers = soldiersRes.data ?? [];
      const counselings = allCounselingsRes.data ?? [];

      const lastCounseling: Record<string, Date> = {};
      for (const c of counselings) {
        if (!lastCounseling[c.soldier_id]) {
          lastCounseling[c.soldier_id] = new Date(c.created_at);
        }
      }

      const now = new Date();
      const complianceAlerts: ComplianceAlert[] = [];

      for (const s of soldiers) {
        const name = `${s.rank} ${s.last_name}`;
        const addedDaysAgo = daysBetween(new Date(s.created_at), now);
        const lastDate = lastCounseling[s.id];
        const daysSinceLast = lastDate ? daysBetween(lastDate, now) : null;

        if (daysSinceLast === null) {
          // No counseling on record
          if (addedDaysAgo > 30) {
            complianceAlerts.push({
              soldier_id: s.id, name, rank: s.rank,
              status: 'initial_overdue',
              days: Math.floor(addedDaysAgo - 30),
            });
          } else if (addedDaysAgo > 23) {
            complianceAlerts.push({
              soldier_id: s.id, name, rank: s.rank,
              status: 'initial_due_soon',
              days: Math.ceil(30 - addedDaysAgo),
            });
          }
        } else if (daysSinceLast > 90) {
          complianceAlerts.push({
            soldier_id: s.id, name, rank: s.rank,
            status: 'quarterly_overdue',
            days: Math.floor(daysSinceLast - 90),
          });
        } else if (daysSinceLast > 83) {
          complianceAlerts.push({
            soldier_id: s.id, name, rank: s.rank,
            status: 'quarterly_due_soon',
            days: Math.ceil(90 - daysSinceLast),
          });
        }
      }

      // Sort: overdue first, then by days descending
      complianceAlerts.sort((a, b) => {
        const aOverdue = a.status.includes('overdue');
        const bOverdue = b.status.includes('overdue');
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        return b.days - a.days;
      });

      setAlerts(complianceAlerts);
      setLoading(false);
    };
    load();
  }, []);

  const displayName = profile
    ? [profile.rank, profile.last_name].filter(Boolean).join(' ') || 'Soldier'
    : '...';

  const promoStat = promoReady ? `${promoReady.green}/${promoReady.total}` : '—';
  const promoSub  = promoReady
    ? `${promoReady.green} of ${promoReady.total} assessed GREEN`
    : 'No assessments yet';

  const overdueCount = alerts.filter(a => a.status.includes('overdue')).length;

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
        <StatCard label="Soldiers Managed" value={loading ? '—' : soldierCount} sub="Active roster" />
        <StatCard
          label="Counselings This Month"
          value={loading ? '—' : counselingCount}
          sub={new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        />
        <StatCard label="Promotion Readiness" value={loading ? '—' : promoStat} sub={loading ? '' : promoSub} accent />
      </div>

      {/* Counseling Compliance */}
      {!loading && alerts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase">
              Counseling Compliance — AR 623-3
            </div>
            {overdueCount > 0 && (
              <div className="font-mono text-[10px] tracking-widest text-danger uppercase">
                {overdueCount} OVERDUE
              </div>
            )}
          </div>
          <div className="border border-border divide-y divide-border">
            {alerts.map(alert => {
              const isOverdue = alert.status.includes('overdue');
              const isInitial = alert.status.includes('initial');
              return (
                <div key={alert.soldier_id} className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOverdue ? 'bg-danger' : 'bg-army-gold'}`} />
                    <div>
                      <div className="font-mono text-sm text-army-text">{alert.name}</div>
                      <div className={`font-mono text-[10px] tracking-wide mt-0.5 ${isOverdue ? 'text-danger' : 'text-army-gold'}`}>
                        {isInitial ? 'Initial counseling' : 'Quarterly counseling'}
                        {' — '}
                        {isOverdue
                          ? `${alert.days} day${alert.days !== 1 ? 's' : ''} overdue`
                          : `due in ${alert.days} day${alert.days !== 1 ? 's' : ''}`
                        }
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/counseling/new')}
                    className={`font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 transition-colors flex-shrink-0 ${
                      isOverdue
                        ? 'border border-danger text-danger hover:bg-danger hover:text-bg'
                        : 'border border-army-gold text-army-gold hover:bg-army-gold hover:text-bg'
                    }`}
                  >
                    COUNSEL
                  </button>
                </div>
              );
            })}
          </div>
          <div className="font-mono text-[10px] text-army-muted mt-2">
            Initial: within 30 days of assignment · Quarterly: every 90 days thereafter (AR 623-3)
          </div>
        </div>
      )}

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
