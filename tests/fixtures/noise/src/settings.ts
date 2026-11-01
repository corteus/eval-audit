// Electron IPC bridge calls whose names contain "Model"/"Agent" are not LLM calls.
export async function load(ipcBridge: any) {
  const models = await ipcBridge.fetchModelList.invoke({});
  await ipcBridge.setDefaultModelSetting.invoke({ id: models[0] });
  return ipcBridge.getManagedAgents.invoke();
}

// The agent product API and an MCP tool client also expose invoke(); neither is an LLM call.
export async function runAgent(agentsApi: any, client: any, id: string) {
  await agentsApi.invoke(id);
  return client.invoke('search', { q: id });
}

// A wrapper class that declares methods named like AI SDK functions is not itself a call site.
export class OllamaLLM {
  async generateText(input: { prompt: string }): Promise<string> {
    return input.prompt;
  }

  async *streamText(input: { prompt: string }) {
    yield input.prompt;
  }
}
