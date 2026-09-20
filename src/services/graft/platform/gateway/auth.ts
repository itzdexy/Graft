import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
export const createGatewayToken = () => `graft_${randomBytes(24).toString('base64url')}`
export const hashGatewayToken = (token: string) => createHash('sha256').update(token).digest('hex')
export function verifyGatewayToken(token: string, hash: string): boolean { const actual = Buffer.from(hashGatewayToken(token)); const expected = Buffer.from(hash); return actual.length === expected.length && timingSafeEqual(actual, expected) }
