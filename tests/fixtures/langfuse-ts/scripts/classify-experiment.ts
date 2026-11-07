import { LangfuseClient } from '@langfuse/client';
import { classify } from '@/classify';

const langfuse = new LangfuseClient();

const result = await langfuse.experiment.run({
  name: 'Classifier check',
  data: [{ input: 'I was charged twice', expectedOutput: 'billing' }],
  task: async (item) => classify(String(item.input)),
  evaluators: [async ({ output, expectedOutput }) => ({ name: 'exact', value: output === expectedOutput ? 1 : 0 })]
});

console.log(await result.format());
