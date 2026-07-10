const anthropic = {
  messages: {
    create: async (request) => request
  }
};

export const supportPrompt = `Resolve a support ticket using the warranty matrix and cite the customer tier.`;

export async function draftSupportReply(ticket) {
  return anthropic.messages.create({
    model: 'claude-3-5-sonnet-latest',
    system: supportPrompt,
    messages: [{ role: 'user', content: ticket }]
  });
}
