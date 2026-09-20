import { afterEach, describe, expect, test } from 'bun:test'
import { isPowerShellToolEnabled } from './shellToolUtils.js'

const prevEnv = process.env.GRAFT_CODE_USE_POWERSHELL_TOOL
const prevUser = process.env.USER_TYPE

afterEach(() => {
  if (prevEnv === undefined) delete process.env.GRAFT_CODE_USE_POWERSHELL_TOOL
  else process.env.GRAFT_CODE_USE_POWERSHELL_TOOL = prevEnv
  if (prevUser === undefined) delete process.env.USER_TYPE
  else process.env.USER_TYPE = prevUser
})

const onWindows = process.platform === 'win32'

describe('isPowerShellToolEnabled', () => {
  test.if(onWindows)('defaults ON for everyone on Windows', () => {
    // Opt-in left Windows users with Bash as the only shell, so a PowerShell
    // one-liner had to be nested inside bash -c "powershell -Command ..." —
    // and bash expands $_ before PowerShell sees it.
    delete process.env.GRAFT_CODE_USE_POWERSHELL_TOOL
    delete process.env.USER_TYPE
    expect(isPowerShellToolEnabled()).toBe(true)
  })

  test.if(onWindows)('can be turned off explicitly', () => {
    process.env.GRAFT_CODE_USE_POWERSHELL_TOOL = '0'
    expect(isPowerShellToolEnabled()).toBe(false)
  })

  test.if(onWindows)('an explicit 1 keeps it on', () => {
    process.env.GRAFT_CODE_USE_POWERSHELL_TOOL = '1'
    expect(isPowerShellToolEnabled()).toBe(true)
  })

  test.if(!onWindows)('stays off on non-Windows platforms', () => {
    delete process.env.GRAFT_CODE_USE_POWERSHELL_TOOL
    expect(isPowerShellToolEnabled()).toBe(false)
  })
})
