import type { ExperimentTaskParams, RunnerContext } from '@langfuse/client';
import { runAgent } from '../src/agent';

async function myTask(item: ExperimentTaskParams) {
  return runAgent(String(item.input));
}

export async function experiment(context: RunnerContext) {
  return await context.runExperiment({ name: 'PR gate', task: myTask });
}
