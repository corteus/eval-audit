const client = {
  chat: {
    completions: {
      create: async (request) => request
    }
  }
};

export const SYSTEM_PROMPT = `Summarize the customer request in one sentence and identify the account risk.`;

export async function summarizeRequest(request) {
  return client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: request }
    ]
  });
}
