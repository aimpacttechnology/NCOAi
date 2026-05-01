interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export default function StatCard({ label, value, sub, accent }: Props) {
  return (
    <div className="bg-surface border border-border p-5 flex flex-col gap-2">
      <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase">{label}</div>
      <div className={`font-mono text-3xl font-bold ${accent ? 'text-army-gold' : 'text-army-text'}`}>
        {value}
      </div>
      {sub && <div className="font-mono text-xs text-army-muted">{sub}</div>}
    </div>
  );
}
