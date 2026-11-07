import { streamText } from 'ai';

export function summarize(thread: string) {
  return streamText({ model: 'openai/gpt-4.1-mini', prompt: `Summarize: ${thread}` });
}
