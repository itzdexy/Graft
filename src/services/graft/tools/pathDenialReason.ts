import type { PermissionDecisionReason } from '../../../types/permissions.js'

/**
 * Turn a permission denial into something the user can act on.
 *
 * Only the `other` variant was ever rendered; every other kind collapsed to the
 * bare string "Path is not allowed by permission rules." A write blocked by a
 * deny rule, by a safety check, and by plan mode all produced that same
 * sentence — the real cause was computed by `isPathAllowed` and thrown away one
 * line later in `validateGraftFileToolPath`.
 *
 * That is what made `Edit "vite.config.js"` failing on `E:\Medal` impossible to
 * diagnose from the transcript: the reason existed the whole time, it just
 * never reached the screen.
 */
/**
 * Is this denial permission *policy* rather than a property of the path?
 *
 * `rule`, `mode` and `workingDir` are decisions the permission system owns —
 * it evaluates them first and prompts the user where the mode calls for it.
 * Everything else (`other` for the UNC/tilde/shell-expansion TOCTOU guards,
 * `safetyCheck` for sensitive files) describes the path itself and must keep
 * failing closed no matter what any prompt said.
 */
export function isPolicyOnlyDenial(
  reason: PermissionDecisionReason | undefined,
): boolean {
  if (!reason) return false
  return (
    reason.type === 'rule' ||
    reason.type === 'mode' ||
    reason.type === 'workingDir'
  )
}

export function describePathDenial(
  reason: PermissionDecisionReason | undefined,
): string {
  const fallback = 'Path is not allowed by permission rules.'
  if (!reason) return fallback

  switch (reason.type) {
    case 'other':
    case 'workingDir':
    case 'safetyCheck':
    case 'asyncAgent':
      return reason.reason || fallback

    case 'classifier':
      return `${reason.reason || fallback} (classifier: ${reason.classifier})`

    case 'hook':
      return reason.reason
        ? `${reason.reason} (hook: ${reason.hookName})`
        : `Blocked by hook ${reason.hookName}.`

    case 'mode':
      // The actionable half is which mode is in force — "Ask" vs "Code" vs
      // "Plan" is exactly the thing the user can change with shift+tab.
      return `Writing this path is not allowed in ${reason.mode} mode. Press shift+tab to change mode.`

    case 'rule': {
      const { ruleValue, source, ruleBehavior } = reason.rule
      const target = ruleValue.ruleContent
        ? `${ruleValue.toolName}(${ruleValue.ruleContent})`
        : ruleValue.toolName
      return `Blocked by a ${ruleBehavior} rule ${target} from ${source}. Check /permissions.`
    }

    case 'sandboxOverride':
      return `Blocked by sandbox policy (${reason.reason}).`

    case 'permissionPromptTool':
      return `Denied by permission prompt tool ${reason.permissionPromptToolName}.`

    case 'subcommandResults':
      return 'One or more subcommands were not allowed.'

    default:
      return fallback
  }
}
