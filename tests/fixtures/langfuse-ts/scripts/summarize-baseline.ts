// Written for Langfuse JS/TS SDK v5, before item.link() was removed.
import { LangfuseClient } from '@langfuse/client';
import { startActiveObservation } from '@langfuse/tracing';
import { summarize } from '../src/summarize';

const langfuse = new LangfuseClient();
const dataset = await langfuse.getDataset('thread-summaries');

for (const item of dataset.items) {
  await startActiveObservation('summarize', async (span) => {
    const result = summarize(String(item.input));
    span.update({ input: item.input, output: await result.text });
    await item.link(span, 'baseline');
  });
}
