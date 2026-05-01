import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const SYSTEM = `You are a senior Army awards officer and S1 NCO with 20 years of experience writing award recommendations on DA Form 638.

You write awards that get approved — specific, impact-focused, properly formatted, and calibrated to the award level.

Award Writing Rules (AR 600-8-22):
- Citations must be in third person
- Lead with the award action verb: "For exceptionally meritorious service..." or "For outstanding achievement..."
- Each accomplishment must be specific: numbers, dates, unit designations, dollar values
- Show impact beyond the individual: how did this help the unit, mission, or Army?
- Calibrate language to the award — AAM is "outstanding achievement," ARCOM is "meritorious service," MSM is "exceptionally meritorious service"
- Citation (the short version on the medal) is 3-7 lines maximum
- Do NOT use superlatives without substance — "best ever" without a metric will get kicked back

Output structure: Justification narrative first (detailed), then the formal Citation (short, medal-ready).`;

const AWARD_VERBS: Record<string, string> = {
  AAM:   'For outstanding achievement',
  ARCOM: 'For meritorious service',
  MSM:   'For exceptionally meritorious service',
  BSM:   'For distinguishing himself/herself by outstanding meritorious service',
  LOM:   'For exceptionally meritorious conduct in the performance of outstanding services',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { soldier, award, position, unit, periodFrom, periodTo, accomplishments, submittedBy } =
    await req.json() as {
      soldier: { name: string; rank: string };
      award: string;
      position: string;
      unit: string;
      periodFrom: string;
      periodTo: string;
      accomplishments: string;
      submittedBy?: string;
    };

  const verb = AWARD_VERBS[award] ?? 'For meritorious service';

  const prompt = `Write a DA Form 638 award recommendation.

AWARD: ${award} — ${getAwardFullName(award)}
SOLDIER: ${soldier.rank} ${soldier.name}
POSITION: ${position}
UNIT: ${unit}
PERIOD: ${periodFrom} to ${periodTo}
RECOMMENDED BY: ${submittedBy || 'Not specified'}

ACCOMPLISHMENTS / INPUT:
${accomplishments}

Generate the full DA 638 recommendation:

## Justification Narrative
3-5 paragraphs. Each paragraph covers a distinct accomplishment area. Be specific — include metrics, timelines, unit sizes, dollar values, mission names where provided. Show how each accomplishment supported the unit mission and Army readiness. This is what the board reads.

## Formal Citation
The short version that appears on the award certificate. Must begin with: "${verb}..."
3-7 lines. Past tense. Third person. Closes with: "[Last name]'s actions reflect great credit upon [himself/herself] and are in keeping with the finest traditions of military service."

Calibrate intensity and language to the ${award} level — not every award is a Congressional Medal of Honor recommendation.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: SYSTEM,
          messages: [{ role: 'user', content: prompt }],
        });
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta')
            controller.enqueue(encoder.encode(chunk.delta.text));
        }
        controller.close();
      } catch (err) { controller.error(err); }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

function getAwardFullName(award: string): string {
  const names: Record<string, string> = {
    AAM:   'Army Achievement Medal',
    ARCOM: 'Army Commendation Medal',
    MSM:   'Meritorious Service Medal',
    BSM:   'Bronze Star Medal',
    LOM:   'Legion of Merit',
    PH:    'Purple Heart',
    SM:    "Soldier's Medal",
  };
  return names[award] ?? award;
}
