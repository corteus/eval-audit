import { streamText } from 'ai';

export async function answer(question: string) {
  return streamText({ model: 'openai/gpt-4o', prompt: question });
}
