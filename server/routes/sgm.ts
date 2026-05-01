import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { anthropic, MODEL } from '../lib/claude';

const router = Router();

const SGM_SYSTEM = `You are a Sergeant Major (SGM) with 25 years of U.S. Army service.
You are an expert in Army doctrine, regulations, and NCO leadership.

When answering questions:
- Be direct and practical — no fluff
- Always cite the relevant regulation or field manual (e.g., AR 600-20, FM 6-22, ADP 6-22)
- Apply doctrine to the specific scenario the NCO describes
- If unsure, say so and recommend they consult their senior NCO or JAG

You help NCOs make better decisions and never guess at regulations.`;

router.post('/ask', async (req: Request, res: Response) => {
  const { message, history = [] } = req.body as {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: message },
  ];

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: SGM_SYSTEM,
      messages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(chunk.delta.text);
      }
    }

    res.end();
  } catch (error) {
    console.error('SGM ask error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to get SGM response' });
    } else {
      res.end();
    }
  }
});

export default router;
