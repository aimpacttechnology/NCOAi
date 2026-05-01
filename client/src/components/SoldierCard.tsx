import { useNavigate } from 'react-router-dom';

interface Soldier {
  id: string;
  first_name: string;
  last_name: string;
  rank: string;
  mos: string | null;
  created_at: string;
  last_counseling?: string | null;
}

export default function SoldierCard({ soldier }: { soldier: Soldier }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/soldiers/${soldier.id}`)}
      className="w-full text-left bg-surface border border-border hover:border-army-tan transition-colors p-4 group"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-sm font-bold text-army-gold group-hover:text-army-gold">
            {soldier.rank} {soldier.last_name}, {soldier.first_name}
          </div>
          <div className="font-mono text-xs text-army-muted mt-1">
            MOS: {soldier.mos || '—'}
          </div>
        </div>
        <div className="font-mono text-[10px] text-army-muted text-right">
          <div>LAST COUNSELING</div>
          <div className="text-army-text mt-0.5">
            {soldier.last_counseling
              ? new Date(soldier.last_counseling).toLocaleDateString()
              : 'None on record'}
          </div>
        </div>
      </div>
    </button>
  );
}
