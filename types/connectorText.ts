/** Connector text stream blocks (ant-only API feature; stub for external builds). */

export type ConnectorTextBlock = {
  type: 'connector_text'
  connector_text: string
  signature?: string
}

export type ConnectorTextDelta = {
  type: 'connector_text_delta'
  connector_text: string
}

export function isConnectorTextBlock(block: unknown): block is ConnectorTextBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    'type' in block &&
    (block as { type: string }).type === 'connector_text'
  )
}
