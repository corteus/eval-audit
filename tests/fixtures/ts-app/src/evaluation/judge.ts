import { generateObject } from 'ai';

// Product feature: lets users grade their own prompts. Not an eval of this app.
export async function gradeUserPrompt(userPrompt: string) {
  return generateObject({ model: 'openai/gpt-4o', prompt: userPrompt, schema: {} as never });
}
