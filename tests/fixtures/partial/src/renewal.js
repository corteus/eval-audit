const model = {
  generateContent: async (request) => request
};

export const renewalPrompt = `Score renewal risk from the account history and explain the top expansion blocker.`;

export async function scoreRenewalRisk(account) {
  return model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `${renewalPrompt}\n${account}` }] }]
  });
}
