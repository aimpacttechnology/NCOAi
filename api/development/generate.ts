import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const SYSTEM = `You are a Command Sergeant Major generating a structured development plan based on a DA Form 4856 counseling.

The DA 4856 is the anchor — everything in this plan flows from what was discussed in the counseling. You are translating the counseling's Plan of Action into a structured, time-bound development roadmap.

Rules:
- Every goal must trace back to something in the counseling content.
- Be specific about WHEN things happen (Month 1, Month 2, Month 3).
- For semi-annual plans: Month 1-6 with quarterly checkpoints.
- For annual plans: Month 1-12 with quarterly checkpoints.
- Include FM 6-22 competency references where appropriate.
- The "Next Counseling Agenda" section is critical — it tells the NCO exactly what to assess at the next formal counseling.`;

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { soldier, counselingType, counselingContent, promotionData, planType } =
    await req.json() as {
      soldier: { name: string; rank: string };
      counselingType: string;
      counselingContent: string;
      promotionData?: { target_rank: string; status: string; gaps: string[] };
      planType: 'initial' | 'semi-annual' | 'annual';
    };

  const duration = planType === 'annual' ? '12-month' : planType === 'semi-annual' ? '6-month' : '90-day';
  const checkpoints = planType === 'annual'
    ? 'quarterly (Month 3, 6, 9, 12)'
    : planType === 'semi-annual'
    ? 'bi-monthly (Month 2, 4, 6)'
    : 'monthly (Day 30, 60, 90)';

  const prompt = `Generate a ${duration} development plan for this soldier based on their DA 4856 counseling.

SOLDIER: ${soldier.rank} ${soldier.name}
COUNSELING TYPE: ${counselingType}
PLAN TYPE: ${planType.toUpperCase()}
CHECKPOINTS: ${checkpoints}

PROMOTION STATUS: ${
    promotionData
      ? `Targeting ${promotionData.target_rank} | ${promotionData.status}
Gaps: ${promotionData.gaps.join(', ') || 'None'}`
      : 'Not assessed'
  }

DA 4856 COUNSELING CONTENT:
${counselingContent}

Generate the development plan with this structure:

## Development Goals
3-5 clear goals derived directly from the counseling. Each goal should be specific and achievable within the plan period.

## ${planType === 'annual' ? 'Quarterly Breakdown' : planType === 'semi-annual' ? 'Bi-Monthly Breakdown' : 'Monthly Breakdown'}
For each period:
**[Period Label]** — [Theme/Focus]
- Priority actions
- FM 6-22 competency focus
- Success indicator

## Mentorship Session Topics
Suggested topics for each mentorship session during this period. These keep the soldier on track between formal counselings.

## Promotion Path Integration
How this plan directly advances the soldier toward ${promotionData?.target_rank || 'their next rank'}. Specific point-earning opportunities.

## Next Counseling Agenda
Exactly what the NCO should assess at the next ${planType === 'initial' ? 'semi-annual' : planType === 'semi-annual' ? 'annual' : 'initial'} counseling. What does success look like at that point?`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
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
