export interface ComixProtectedImageHeaders {
    [name: string]: unknown
}

export interface ComixDecodedProtectedImage {
    imageBase64: string
    scrambleSeed: number
    scrambleAlgorithm?: string
    shouldDescrambleGrid: boolean
}

const ENCRYPTION_MULTIPLIER = 1_000_005
const ENCRYPTION_INCREMENT = 1_234_567_891

function header(
    headers: ComixProtectedImageHeaders,
    name: string
): string | undefined {
    const match = Object.entries(headers).find(([key]) =>
        key.toLowerCase() === name.toLowerCase()
    )?.[1]
    return typeof match === 'string' || typeof match === 'number'
        ? String(match)
        : undefined
}

function int32(value?: string): number | undefined {
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed | 0 : undefined
}

function hasImageSignature(bytes: Uint8Array): boolean {
    const isJpeg = bytes.length >= 2 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8
    const isPng = bytes.length >= 4 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
    const isWebP = bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    return isJpeg || isPng || isWebP
}

function nextXorshiftState(state: number): number {
    let next = state | 0
    next ^= next << 13
    next ^= next >>> 17
    next ^= next << 5
    return next | 0
}

function decodeWithXorshift(
    source: Uint8Array,
    initialState: number,
    length: number,
    highByte: boolean
): Uint8Array {
    const result = source.slice()
    let state = initialState | 0
    const limit = Math.min(result.length, Math.max(0, length))
    for (let index = 0; index < limit; index += 1) {
        state = nextXorshiftState(state)
        const key = highByte ? state >>> 24 : state & 0xff
        result[index] = (result[index] ?? 0) ^ key
    }
    return result
}

function decodeWithLcg(
    source: Uint8Array,
    seed: number,
    length: number
): Uint8Array {
    const result = source.slice()
    let state = seed | 0
    const limit = Math.min(result.length, Math.max(0, length))
    for (let index = 0; index < limit; index += 1) {
        state = (
            Math.imul(state, ENCRYPTION_MULTIPLIER) +
            ENCRYPTION_INCREMENT
        ) | 0
        result[index] = (result[index] ?? 0) ^ (state >>> 24)
    }
    return result
}

function decodeEncodedBytes(
    source: Uint8Array,
    seed: number,
    length: number,
    algorithm?: string
): Uint8Array {
    if (algorithm !== '2') {
        return decodeWithLcg(source, seed, length)
    }

    const candidates = [
        decodeWithXorshift(source, seed | 1, length, false),
        decodeWithXorshift(source, seed, length, false),
        decodeWithXorshift(source, seed | 1, length, true),
        decodeWithLcg(source, seed, length)
    ]
    return candidates.find(hasImageSignature) ?? candidates[0]!
}

function scrambleHash(value?: string): number {
    switch (value?.trim()) {
        case '03632':
            return 58_414
        case '02900':
            return 117_532
        default:
            // Comix's current Android extension treats unknown rotating
            // identifiers as an absent mask. The raw scramble seed remains
            // valid; rejecting it incorrectly forces a slow WebView fallback.
            return 0
    }
}

export function addComixV3Flag(url: string): string {
    const hashIndex = url.indexOf('#')
    const withoutFragment = hashIndex >= 0 ? url.slice(0, hashIndex) : url
    if (/[?&]v3(?:[=&]|$)/.test(withoutFragment)) return withoutFragment
    return `${withoutFragment}${withoutFragment.includes('?') ? '&' : '?'}v3`
}

export function decodeComixProtectedImage(
    bodyBase64: string,
    headers: ComixProtectedImageHeaders
): ComixDecodedProtectedImage {
    const original = Uint8Array.from(Buffer.from(bodyBase64, 'base64'))
    if (original.length === 0) {
        throw new Error('Comix returned an empty protected image')
    }

    const encryptionSeed = int32(header(headers, 'x-enc-seed'))
    const encryptionLength = Number(header(headers, 'x-enc-len'))
    const encryptionAlgorithm = header(headers, 'x-enc-algo')
    const needsXor = encryptionSeed !== undefined &&
        encryptionSeed !== 0 &&
        Number.isFinite(encryptionLength)
    const decoded = needsXor
        ? decodeEncodedBytes(
            original,
            encryptionSeed,
            encryptionLength,
            encryptionAlgorithm
        )
        : original

    if (!hasImageSignature(decoded)) {
        throw new Error(
            needsXor
                ? 'Comix image decryption did not produce a valid image'
                : 'Comix returned invalid protected image data'
        )
    }

    const rawScrambleSeed = int32(header(headers, 'x-scramble-seed'))
    const grid = header(headers, 'x-scramble-grid')
    const algorithm = header(headers, 'x-scramble-algo')
    const supportedAlgorithm = algorithm === undefined ||
        algorithm === '1' ||
        algorithm === '2' ||
        algorithm === '3'
    const shouldDescrambleGrid = grid === '5x5' &&
        supportedAlgorithm &&
        rawScrambleSeed !== undefined &&
        rawScrambleSeed !== 0
    const rawScrambleHash = header(headers, 'x-scramble-hash')
    const decodedScrambleHash = scrambleHash(rawScrambleHash)

    return {
        imageBase64: Buffer.from(decoded).toString('base64'),
        scrambleSeed: shouldDescrambleGrid
            ? (rawScrambleSeed! ^ decodedScrambleHash)
            : 0,
        scrambleAlgorithm: algorithm,
        shouldDescrambleGrid
    }
}
