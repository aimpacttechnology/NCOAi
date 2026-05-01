import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const NCOER_SYSTEM = `You are a Command Sergeant Major with 28 years of U.S. Army service and extensive experience writing and reviewing NCOERs (DA Form 2166-9 series).

You write evaluation bullets that are:
- Specific, quantifiable, and impact-focused
- Written in past tense starting with strong action verbs
- Compliant with AR 623-3 and PAM 623-3
- Grounded in FM 6-22 leader attributes and competencies
- Free of flowery language — direct and factual

NCOER Bullet Rules:
- One idea per bullet, 1–2 lines max
- Lead with the action, follow with the impact/result
- Use Army abbreviations: IAW, NLT, SOP, POI, MOS, NCO, etc.
- Quantify everything possible: Soldiers trained, equipment value, pass rates, time saved, missions completed
- "Achieves" bullets must reflect mission accomplishment with measurable results
- Senior Rater narrative should project future potential and be written in present/future tense`;

const SECTIONS = [
  'Character (Army Values / LDRSHIP)',
  'Presence (Military Bearing, Fitness, Confidence, Resilience)',
  'Intellect (Judgment, Innovation, Expertise)',
  'Leads (Leads Others, Builds Trust, Communicates)',
  'Develops (Develops Others, Creates Positive Environment)',
  'Achieves (Gets Results)',
  'Senior Rater Narrative (Potential)',
];

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { soldier, position, unit, ratingPeriod, accomplishments, sections } =
    await req.json() as {
      soldier: { name: string; rank: string };
      position: string;
      unit: string;
      ratingPeriod: { from: string; to: string };
      accomplishments: string;
      sections: string[];
    };

  if (!soldier?.name || !accomplishments?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const selectedSections = sections?.length ? sections : SECTIONS;

  const prompt = `Generate NCOER bullets for DA Form 2166-9.

SOLDIER: ${soldier.rank} ${soldier.name}
POSITION: ${position || 'Not specified'}
UNIT: ${unit || 'Not specified'}
RATING PERIOD: ${ratingPeriod?.from || 'N/A'} – ${ratingPeriod?.to || 'N/A'}

ACCOMPLISHMENTS / INPUT:
${accomplishments}

Generate 3–5 strong bullets for each of the following NCOER sections. Use only information derivable from the accomplishments above — do not fabricate specifics.

Sections to generate:
${selectedSections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Format your output exactly as:
## [Section Name]
• [bullet]
• [bullet]
• [bullet]

Separate each section with a blank line.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: NCOER_SYSTEM,
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
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
