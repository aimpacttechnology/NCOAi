async function stream(url: string, payload: unknown, onChunk: (t: string) => void) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No stream');
  const dec = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(dec.decode(value, { stream: true }));
  }
}

export const prepareMentorship    = (p: unknown, cb: (t: string) => void) =>
  stream('/api/mentorship/prepare', p, cb);

export const analyzeUnitGaps      = (p: unknown, cb: (t: string) => void) =>
  stream('/api/training/gaps', p, cb);

export const generateAwardRec     = (p: unknown, cb: (t: string) => void) =>
  stream('/api/awards/generate', p, cb);

export const generateDevelopmentPlan = (p: unknown, cb: (t: string) => void) =>
  stream('/api/development/generate', p, cb);

export const assistJournal = (p: unknown, cb: (t: string) => void) =>
  stream('/api/journal/assist', p, cb);

export async function getPromotionAdvice(
  payload: Record<string, unknown>,
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch('/api/promotion/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export async function generateCounseling(
  payload: {
    soldier: { name: string; rank: string };
    type: string;
    observations: string;
    plan_of_action: string;
    followup: string;
    nco_id?: string;
    soldier_id?: string;
  },
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch('/api/counseling/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Server error ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export async function generateNCOER(
  payload: {
    soldier: { name: string; rank: string };
    position: string;
    unit: string;
    ratingPeriod: { from: string; to: string };
    accomplishments: string;
    sections: string[];
  },
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch('/api/ncoer/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Server error ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export async function askSGM(
  payload: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  },
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch('/api/sgm/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Server error ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
