/**
 * Windows console raw mode via kernel32 SetConsoleMode.
 * Bun's inherited process.stdin often throws from node:tty setRawMode even in
 * a real integrated terminal — SetConsoleMode on STD_INPUT_HANDLE still works.
 */

const STD_INPUT_HANDLE = -10
const STD_OUTPUT_HANDLE = -11
const STD_ERROR_HANDLE = -12

const ENABLE_PROCESSED_INPUT = 0x0001
const ENABLE_LINE_INPUT = 0x0002
const ENABLE_ECHO_INPUT = 0x0004
const ENABLE_VIRTUAL_TERMINAL_INPUT = 0x0200

const ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
const DISABLE_NEWLINE_AUTO_RETURN = 0x0008

const COOKED_INPUT =
  ENABLE_PROCESSED_INPUT | ENABLE_LINE_INPUT | ENABLE_ECHO_INPUT

let kernel32:
  | {
      GetStdHandle: (nStdHandle: number) => number
      GetConsoleMode: (hConsole: number, lpMode: Buffer) => number
      SetConsoleMode: (hConsole: number, dwMode: number) => number
    }
  | undefined

function loadKernel32():
  | {
      GetStdHandle: (nStdHandle: number) => number
      GetConsoleMode: (hConsole: number, lpMode: Buffer) => number
      SetConsoleMode: (hConsole: number, dwMode: number) => number
    }
  | undefined {
  if (kernel32 !== undefined) {
    return kernel32 || undefined
  }
  try {
    const { dlopen, FFIType } = require('bun:ffi') as typeof import('bun:ffi')
    const lib = dlopen('kernel32.dll', {
      GetStdHandle: {
        args: [FFIType.i32],
        returns: FFIType.u32,
      },
      GetConsoleMode: {
        args: [FFIType.u32, FFIType.ptr],
        returns: FFIType.i32,
      },
      SetConsoleMode: {
        args: [FFIType.u32, FFIType.u32],
        returns: FFIType.i32,
      },
    })
    kernel32 = lib.symbols as typeof kernel32
    return kernel32
  } catch {
    kernel32 = null as unknown as undefined
    return undefined
  }
}

/** True when SetConsoleMode successfully toggled console input mode. */
export function setWindowsConsoleRawMode(raw: boolean): boolean {
  if (process.platform !== 'win32') {
    return false
  }
  const k32 = loadKernel32()
  if (!k32) {
    return false
  }
  const handle = k32.GetStdHandle(STD_INPUT_HANDLE)
  if (!handle || handle === 0xffffffff) {
    return false
  }
  const modeBuf = Buffer.alloc(4)
  if (!k32.GetConsoleMode(handle, modeBuf)) {
    return false
  }
  let mode = modeBuf.readUInt32LE(0)
  if (raw) {
    mode &= ~COOKED_INPUT
    mode |= ENABLE_VIRTUAL_TERMINAL_INPUT
  } else {
    mode |= COOKED_INPUT
  }
  return k32.SetConsoleMode(handle, mode) !== 0
}

function setHandleVtProcessing(handle: number, k32: NonNullable<typeof kernel32>): boolean {
  if (!handle || handle === 0xffffffff) {
    return false
  }
  const modeBuf = Buffer.alloc(4)
  if (!k32.GetConsoleMode(handle, modeBuf)) {
    return false
  }
  let mode = modeBuf.readUInt32LE(0)
  mode |= ENABLE_VIRTUAL_TERMINAL_PROCESSING
  mode &= ~DISABLE_NEWLINE_AUTO_RETURN
  return k32.SetConsoleMode(handle, mode) !== 0
}

/**
 * Enable virtual-terminal processing on stdout/stderr. Required on Windows
 * so ANSI escape sequences (colors, cursor moves, mouse tracking) are
 * interpreted by the console instead of printed as visible text. Idempotent.
 */
export function setWindowsConsoleOutputMode(): void {
  if (process.platform !== 'win32') {
    return
  }
  const k32 = loadKernel32()
  if (!k32) {
    return
  }
  setHandleVtProcessing(k32.GetStdHandle(STD_OUTPUT_HANDLE), k32)
  setHandleVtProcessing(k32.GetStdHandle(STD_ERROR_HANDLE), k32)
}
