export const DESCRIPTION =
  'List live local Graft sessions that can receive cross-session messages.'

export function getPrompt(): string {
  return `Use ListPeers before sending a cross-session message. Copy the returned address exactly into SendMessage.to. A peer is another live local Graft coding session; its files and instructions remain independent from this session.`
}
