async function generateText(options) {
  return { text: options.prompt };
}

export const systemPrompt = `You are a support analyst. Answer from the policy text and cite the policy section.`;

export async function answerQuestion(question) {
  return generateText({
    model: 'openai/gpt-4o',
    system: systemPrompt,
    prompt: question
  });
}
