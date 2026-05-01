import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const SYSTEM = `You are a Command Sergeant Major preparing a junior NCO for a mentorship session with one of their soldiers.

Your job is to give the NCO specific, actionable talking points — not generic leadership advice. Think of this as a pre-mission brief for a developmental conversation.

FM 6-22 frames leader development around six attributes/competencies: Character, Presence, Intellect, Leads, Develops, Achieves.

Rules:
- Be direct. NCO-to-NCO language.
- Every talking point must be specific to THIS soldier's data.
- Focus on 2-3 areas maximum — don't try to cover everything in one session.
- Include at least one question to ASK the soldier (not just things to tell them).
- End with one concrete action for the NCO to assign before the next meeting.`;

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { soldier, promotionData, lastCounseling, lastMentorship, sessionFocus } =
    await req.json() as {
      soldier: { name: string; rank: string; mos: string | null };
      promotionData?: {
        target_rank: string;
        status: string;
        total: number;
        maxScore: number;
        gaps: string[];
      };
      lastCounseling?: { type: string; date: string; summary?: string };
      lastMentorship?: { date: string; follow_ups?: string[] };
      sessionFocus?: string[];
    };

  const daysSinceLastMentor = lastMentorship
    ? Math.floor((Date.now() - new Date(lastMentorship.date).getTime()) / 86400000)
    : null;

  const prompt = `Prepare mentorship talking points for this session.

SOLDIER: ${soldier.rank} ${soldier.name} | MOS: ${soldier.mos || 'Unknown'}

PROMOTION STATUS: ${
    promotionData
      ? `Targeting ${promotionData.target_rank} | ${promotionData.status} (${promotionData.total}/${promotionData.maxScore} pts)
Gaps: ${promotionData.gaps.length > 0 ? promotionData.gaps.join(', ') : 'None identified'}`
      : 'Not yet assessed'
  }

LAST COUNSELING: ${
    lastCounseling
      ? `${lastCounseling.type} on ${new Date(lastCounseling.date).toLocaleDateString()}${lastCounseling.summary ? ` — "${lastCounseling.summary}"` : ''}`
      : 'None on record'
  }

LAST MENTORSHIP SESSION: ${
    daysSinceLastMentor !== null
      ? `${daysSinceLastMentor} days ago${lastMentorship?.follow_ups?.length ? ` | Open follow-ups: ${lastMentorship.follow_ups.join(', ')}` : ''}`
      : 'No prior sessions'
  }

SESSION FOCUS REQUESTED: ${sessionFocus?.length ? sessionFocus.join(', ') : 'NCO discretion — prioritize highest-impact areas'}

Generate talking points for this mentorship session. Structure:

## Opening Check-In
One question to take the soldier's temperature — how are they doing, what's on their mind.

## Primary Focus (pick 1-2 FM 6-22 competency areas most relevant to this soldier)
For each area:
- What to discuss and why it matters for THIS soldier right now
- A direct question to ask them
- A key point to reinforce

## Addressing Open Items
${lastMentorship?.follow_ups?.length ? 'How to follow up on previous commitments.' : '(No open items — skip this section)'}

## Promotion Path
Specific conversation about the ${promotionData?.target_rank || 'next rank'} — what they need to focus on in the next 30 days.

## Assignment Before Next Session
One concrete, measurable thing for the soldier to do before you meet again.`;

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
