import { generateObject } from 'ai';
import { z } from 'zod';

export async function classify(ticket: string) {
  const { object } = await generateObject({
    model: 'openai/gpt-4.1-mini',
    schema: z.object({ area: z.enum(['billing', 'tech', 'sales']) }),
    prompt: ticket
  });
  return object.area;
}
