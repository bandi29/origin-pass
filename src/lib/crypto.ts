import { randomBytes } from 'crypto'

export function generateSerialId(prefix: string = 'OP'): string {
    // Generate a random 6-byte buffer and convert to hex (12 chars)
    const buffer = randomBytes(6)
    return `${prefix}-${buffer.toString('hex').toUpperCase()}`
}
