import { generateText } from 'ai';
import { startActiveObservation } from '@langfuse/tracing';

export async function assist(question: string) {
  return startActiveObservation('assist', async (span) => {
    const { text } = await generateText({ model: 'openai/gpt-4.1', prompt: question });
    span.update({ input: question, output: text });
    return text;
  });
}
