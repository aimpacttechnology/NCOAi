// Shared promotion scoring logic — used by Dashboard and PromotionReadiness

export interface CustomPoint {
  label: string;
  points: number;
}

export interface PromotionData {
  id?: string;
  soldier_id: string;
  nco_id: string;
  target_rank: string;
  tis_months: number;
  tig_months: number;
  acft_score: number;
  weapons_qual: string;
  wlc_complete: boolean;
  alc_complete: boolean;
  slc_complete: boolean;
  awards: Record<string, number>;
  degree: string;
  college_credits: number;
  extra_courses: number;
  custom_points: CustomPoint[];
}

export const AWARDS_CATALOG = [
  { key: 'BSM',   label: 'Bronze Star Medal (BSM)',          points: 30 },
  { key: 'PH',    label: 'Purple Heart (PH)',                 points: 30 },
  { key: 'MSM',   label: 'Meritorious Service Medal (MSM)',   points: 25 },
  { key: 'ARCOM', label: 'Army Commendation Medal (ARCOM)',   points: 20 },
  { key: 'AAM',   label: 'Army Achievement Medal (AAM)',      points: 10 },
  { key: 'GCM',   label: 'Good Conduct Medal (GCM)',          points: 10 },
];

export const PREREQS: Record<string, { tis: number; tig: number; wlc: boolean; alc: boolean; slc: boolean }> = {
  SGT:  { tis: 18,  tig: 8,  wlc: true,  alc: false, slc: false },
  SSG:  { tis: 48,  tig: 12, wlc: true,  alc: false, slc: false },
  SFC:  { tis: 84,  tig: 36, wlc: true,  alc: true,  slc: false },
  MSG:  { tis: 144, tig: 36, wlc: true,  alc: true,  slc: true  },
  '1SG':{ tis: 144, tig: 36, wlc: true,  alc: true,  slc: true  },
  SGM:  { tis: 192, tig: 36, wlc: true,  alc: true,  slc: true  },
};

export function calcScore(d: PromotionData) {
  const breakdown: Record<string, { earned: number; max: number }> = {
    'Military Training': { earned: 0, max: 100 },
    Awards:              { earned: 0, max: 125 },
    'Military Education':{ earned: 0, max: 200 },
    'Civilian Education':{ earned: 0, max: 75  },
  };

  const acftPts = Math.min(60, Math.floor(d.acft_score / 10));
  const weapPts = ({ Expert: 40, Sharpshooter: 30, Marksman: 15, Unqualified: 0, 'N/A': 0 } as Record<string, number>)[d.weapons_qual] ?? 0;
  breakdown['Military Training'].earned = Math.min(100, acftPts + weapPts);

  let awardTotal = 0;
  for (const a of AWARDS_CATALOG) awardTotal += (d.awards[a.key] ?? 0) * a.points;
  breakdown['Awards'].earned = Math.min(125, awardTotal);

  const eduPts = (d.wlc_complete ? 80 : 0) + (d.alc_complete ? 80 : 0) + (d.slc_complete ? 40 : 0)
    + Math.min(40, d.extra_courses * 10);
  breakdown['Military Education'].earned = Math.min(200, eduPts);

  const degPts = ({ None: 0, 'Some College': 10, Associate: 40, Bachelor: 75, 'Master or higher': 75 } as Record<string, number>)[d.degree] ?? 0;
  const creditPts = Math.min(25, Math.floor(d.college_credits * 0.5));
  breakdown['Civilian Education'].earned = Math.min(75, Math.max(degPts, creditPts));

  for (const c of (d.custom_points ?? [])) {
    if (c.label.trim()) breakdown[c.label] = { earned: c.points, max: c.points };
  }

  const total    = Object.values(breakdown).reduce((s, v) => s + v.earned, 0);
  const maxScore = Object.values(breakdown).reduce((s, v) => s + v.max,    0);

  const req = PREREQS[d.target_rank];
  const gaps: string[] = [];
  if (req) {
    if (d.tis_months < req.tis)  gaps.push(`TIS: need ${req.tis} months`);
    if (d.tig_months < req.tig)  gaps.push(`TIG: need ${req.tig} months`);
    if (req.wlc && !d.wlc_complete) gaps.push('WLC not complete');
    if (req.alc && !d.alc_complete) gaps.push('ALC not complete');
    if (req.slc && !d.slc_complete) gaps.push('SLC not complete');
  }
  const prereqsMet = gaps.length === 0;

  const pct = maxScore > 0 ? total / maxScore : 0;
  let status: 'GREEN' | 'AMBER' | 'RED';
  if (!prereqsMet || pct < 0.4) status = 'RED';
  else if (pct < 0.65)          status = 'AMBER';
  else                          status = 'GREEN';

  return { total, maxScore, breakdown, status, gaps, prereqsMet };
}
