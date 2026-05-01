import { Router, Request, Response } from 'express';
import { anthropic, MODEL } from '../lib/claude';

const router = Router();

const ADVISOR_SYSTEM = `You are a Command Sergeant Major and senior promotion board advisor with 28 years of service.

You give direct, specific promotion readiness guidance. Your job is to:
- Tell the NCO exactly what to do to improve their soldier's score
- Prioritize actions by point impact and eligibility impact
- Use Army language and abbreviations (TIS, TIG, WLC, ALC, ACFT, MOS, AR 600-8-19)
- Be specific: name the exact award, course, or action needed
- Never be vague — give timelines and point estimates where possible`;

router.post('/score', async (req: Request, res: Response) => {
  const input = req.body;

  if (!input?.soldier?.name) {
    res.status(400).json({ error: 'Missing soldier data' });
    return;
  }

  const gapList = input.gaps?.length > 0
    ? input.gaps.map((g: string) => `• ${g}`).join('\n')
    : '• No critical gaps identified';

  const breakdownText = Object.entries(input.breakdown || {})
    .map(([cat, v]: [string, unknown]) => {
      const val = v as { earned: number; max: number };
      return `  ${cat}: ${val.earned}/${val.max} pts`;
    })
    .join('\n');

  const awardsText = Object.entries(input.awards || {})
    .filter(([, count]) => (count as number) > 0)
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

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: ADVISOR_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(chunk.delta.text);
      }
    }
    res.end();
  } catch (error) {
    console.error('Promotion score error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Generation failed' });
    else res.end();
  }
});

export default router;
