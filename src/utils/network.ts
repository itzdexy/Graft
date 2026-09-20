import { networkInterfaces } from 'node:os'

const LOOPBACK_ADDRESSES = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
])

function hasPhysicalNetworkInterface(): boolean {
  const interfaces = networkInterfaces()
  for (const [, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue
    for (const addr of addrs) {
      if (addr.internal) continue
      if (LOOPBACK_ADDRESSES.has(addr.address)) continue
      // Link-local IPv6 addresses still require an interface, but they can't
      // reach the internet. Ignore them so we don't claim "online" when only
      // a disconnected or purely local interface is up.
      if (addr.address.startsWith('fe80:') || addr.address.startsWith('169.254.')) continue
      return true
    }
  }
  return false
}

/**
 * Returns true when the machine has a non-loopback, non-link-local network
 * interface (e.g. Ethernet or Wi-Fi). This is intentionally not an internet
 * reachability probe; it simply detects whether the OS reports a real network
 * connection, matching the user's "no ethernet/wifi detected" request.
 *
 * Set GRAFT_OFFLINE=1 to force offline, or GRAFT_ONLINE=1 to force online.
 */
export function isNetworkConnected(): boolean {
  if (process.env.GRAFT_OFFLINE) return false
  if (process.env.GRAFT_ONLINE) return true
  return hasPhysicalNetworkInterface()
}

export type NetworkStatus = 'online' | 'offline' | 'forced-offline' | 'forced-online'

export function getNetworkStatus(): NetworkStatus {
  if (process.env.GRAFT_OFFLINE) return 'forced-offline'
  if (process.env.GRAFT_ONLINE) return 'forced-online'
  return hasPhysicalNetworkInterface() ? 'online' : 'offline'
}

/** User-facing copy — NIC presence is not proof of internet reachability. */
export function getNetworkStatusLabel(status = getNetworkStatus()): string {
  switch (status) {
    case 'forced-offline':
      return 'Forced offline (GRAFT_OFFLINE=1)'
    case 'forced-online':
      return 'Forced online (GRAFT_ONLINE=1)'
    case 'offline':
      return 'No network interface detected — may be offline'
    case 'online':
      return 'Network interface present (internet not verified)'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}
