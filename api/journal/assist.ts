import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';

const SYSTEM = `You are a senior NCO helping a leader articulate a lesson, experience, or piece of wisdom they want to capture for future NCOs.

Your job is to help them:
1. Clarify the core lesson in clear, direct language
2. Connect it to Army doctrine or values where natural
3. Make it useful and memorable for junior NCOs who will read it

Keep the NCO's voice — don't make it sound like a regulation or a lecture. It should sound like a senior NCO talking to a junior one over coffee.

Output: A well-structured journal entry, 150-300 words. Include a suggested title if they didn't provide one. End with a one-sentence "Bottom Line" that captures the essence.`;

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { rawThought, context } = await req.json() as {
    rawThought: string;
    context?: string;
  };

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          system: SYSTEM,
          messages: [{
            role: 'user',
            content: `Help me turn this into a wisdom journal entry.\n\nContext: ${context || 'General NCO leadership experience'}\n\nRaw thought:\n${rawThought}`,
          }],
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
