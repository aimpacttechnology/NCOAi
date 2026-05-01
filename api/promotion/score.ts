import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const ADVISOR_SYSTEM = `You are a Command Sergeant Major and senior promotion board advisor with 28 years of service.

You give direct, specific promotion readiness guidance. Your job is to:
- Tell the NCO exactly what to do to improve their soldier's score
- Prioritize actions by point impact and eligibility impact
- Use Army language and abbreviations (TIS, TIG, WLC, ALC, ACFT, MOS, AR 600-8-19)
- Be specific: name the exact award, course, or action needed
- Never be vague — give timelines and point estimates where possible`;

export interface PromotionInput {
  soldier: { name: string; rank: string };
  targetRank: string;
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
  score: number;
  maxScore: number;
  breakdown: Record<string, { earned: number; max: number }>;
  status: string;
  gaps: string[];
  prereqsMet: boolean;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const input = await req.json() as PromotionInput;

  const gapList = input.gaps.length > 0
    ? input.gaps.map(g => `• ${g}`).join('\n')
    : '• No critical gaps identified';

  const breakdownText = Object.entries(input.breakdown)
    .map(([cat, { earned, max }]) => `  ${cat}: ${earned}/${max} pts`)
    .join('\n');

  const awardsText = Object.entries(input.awards)
    .filter(([, count]) => count > 0)
    .map(([award, count]) => `${award} x${count}`)
    .join(', ') || 'None';

  const prompt = `Analyze this soldier's promotion readiness and give specific recommendations.

SOLDIER: ${input.soldier.rank} ${input.soldier.name}
TARGET PROMOTION: ${input.targetRank}
OVERALL STATUS: ${input.status} (${input.score}/${input.maxScore} pts — ${Math.round((input.score / input.maxScore) * 100)}%)
PREREQUISITES MET: ${input.prereqsMet ? 'YES' : 'NO — SOLDIER IS NOT BOARD ELIGIBLE'}

POINT BREAKDOWN:
${breakdownText}

KEY DATA:
• TIS: ${input.tis_months} months | TIG: ${input.tig_months} months
• ACFT: ${input.acft_score} | Weapons: ${input.weapons_qual}
• WLC: ${input.wlc_complete ? 'Complete' : 'Incomplete'} | ALC: ${input.alc_complete ? 'Complete' : 'Incomplete'} | SLC: ${input.slc_complete ? 'Complete' : 'Incomplete'}
• Awards: ${awardsText}
• Education: ${input.degree}${input.college_credits > 0 ? ` + ${input.college_credits} credits` : ''}
• Additional courses: ${input.extra_courses}

IDENTIFIED GAPS:
${gapList}

Give 5–7 specific, prioritized recommendations to improve this soldier's promotion readiness. Start with eligibility blockers, then highest-point-impact actions. Be direct — no filler.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: ADVISOR_SYSTEM,
          messages: [{ role: 'user', content: prompt }],
        });
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
