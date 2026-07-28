export type AutomationRisk =
  | 'passive'
  | 'interaction'
  | 'sensitive'
  | 'destructive'

export type AutomationTarget = {
  kind: 'browser' | 'desktop'
  application?: string
  url?: string
}

export type AutomationAction =
  | { type: 'observe'; target: AutomationTarget }
  | { type: 'navigate'; target: AutomationTarget; url: string }
  | { type: 'click'; target: AutomationTarget; ref?: string; x?: number; y?: number }
  | { type: 'type'; target: AutomationTarget; ref?: string; text: string }
  | { type: 'scroll'; target: AutomationTarget; deltaX?: number; deltaY: number }
  | { type: 'keypress'; target: AutomationTarget; keys: string[] }
  | { type: 'screenshot'; target: AutomationTarget }
  | { type: 'upload'; target: AutomationTarget; paths: string[] }
  | { type: 'download'; target: AutomationTarget; url?: string }
  | { type: 'clipboard_read'; target: AutomationTarget }
  | { type: 'clipboard_write'; target: AutomationTarget; text: string }
  | { type: 'open_application'; target: AutomationTarget; application: string }
  | { type: 'purchase'; target: AutomationTarget; description: string }
  | { type: 'send_external_message'; target: AutomationTarget; description: string }
  | { type: 'change_account'; target: AutomationTarget; description: string }
  | { type: 'destructive'; target: AutomationTarget; description: string }

export type AutomationObservation = {
  target: AutomationTarget
  accessibilityTree?: string
  screenshotBase64?: string
  width?: number
  height?: number
}

export interface AutomationAdapter {
  readonly id: string
  readonly kind: 'browser' | 'desktop'
  isAvailable(): Promise<boolean>
  observe(target: AutomationTarget, signal: AbortSignal): Promise<AutomationObservation>
  act(action: AutomationAction, signal: AbortSignal): Promise<AutomationObservation | void>
  close(): Promise<void>
}

export function automationRisk(action: AutomationAction): AutomationRisk {
  switch (action.type) {
    case 'observe':
    case 'screenshot':
      return 'passive'
    case 'navigate':
    case 'scroll':
      return 'interaction'
    case 'click':
    case 'type':
    case 'keypress':
    case 'upload':
    case 'download':
    case 'clipboard_read':
    case 'clipboard_write':
    case 'open_application':
      return 'sensitive'
    case 'purchase':
    case 'send_external_message':
    case 'change_account':
    case 'destructive':
      return 'destructive'
  }
}
