export type ProviderModelDisplayInput = {
  providerId?: string | null
  modelId: string
  label?: string | null
}

export function formatProviderModelDisplayName(
  input: ProviderModelDisplayInput,
): string
