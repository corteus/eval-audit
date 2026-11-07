import { generateText } from 'ai';

export async function runAgent(question: string) {
  const { text } = await generateText({ model: 'openai/gpt-4.1', prompt: question });
  return text;
}
