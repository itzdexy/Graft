/** Native OpenAI reasoning models use completion budgets and omit sampling knobs. */
export function usesOpenAiReasoningParameters(providerId: string, model: string): boolean {
  return providerId === 'openai' && /^(?:gpt-[56](?:[.-]|$)|o[134](?:-|$))/i.test(model)
}

export function completionBudget(providerId: string, model: string, tokens: number) {
  return usesOpenAiReasoningParameters(providerId, model)
    ? { max_completion_tokens: tokens }
    : { max_tokens: tokens }
}
