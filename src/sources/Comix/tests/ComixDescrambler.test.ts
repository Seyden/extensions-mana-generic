import {
    addComixV3Flag,
    decodeComixProtectedImage
} from '../reader/ComixDescrambler'

function encodeLcg(source: Uint8Array, seed: number): Uint8Array {
    const result = source.slice()
    let state = seed | 0
    for (let index = 0; index < result.length; index += 1) {
        state = (Math.imul(state, 1_000_005) + 1_234_567_891) | 0
        result[index] = (result[index] ?? 0) ^ (state >>> 24)
    }
    return result
}

function encodeXorshift(source: Uint8Array, initialState: number): Uint8Array {
    const result = source.slice()
    let state = initialState | 0
    for (let index = 0; index < result.length; index += 1) {
        state ^= state << 13
        state ^= state >>> 17
        state ^= state << 5
        state |= 0
        result[index] = (result[index] ?? 0) ^ (state & 0xff)
    }
    return result
}

describe('Comix protected image decoding', () => {
    const png = Uint8Array.from([
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d
    ])

    test('adds the V3 request flag without preserving fragments or duplicating it', () => {
        expect(addComixV3Flag('https://cdn.example/i5/page')).toBe(
            'https://cdn.example/i5/page?v3'
        )
        expect(addComixV3Flag('https://cdn.example/i5/page?x=1#scrambled')).toBe(
            'https://cdn.example/i5/page?x=1&v3'
        )
        expect(addComixV3Flag('https://cdn.example/i5/page?v3')).toBe(
            'https://cdn.example/i5/page?v3'
        )
    })

    test('decodes LCG-encrypted image bytes and resolves the grid seed', () => {
        const seed = 123_456
        const encoded = encodeLcg(png, seed)
        const result = decodeComixProtectedImage(
            Buffer.from(encoded).toString('base64'),
            {
                'X-Enc-Seed': String(seed),
                'X-Enc-Len': String(encoded.length),
                'X-Enc-Algo': '1',
                'X-Scramble-Seed': '999',
                'X-Scramble-Grid': '5x5',
                'X-Scramble-Algo': '3',
                'X-Scramble-Hash': '03632'
            }
        )

        expect(Buffer.from(result.imageBase64, 'base64')).toEqual(Buffer.from(png))
        expect(result.shouldDescrambleGrid).toBe(true)
        expect(result.scrambleSeed).toBe(999 ^ 58_414)
        expect(result.scrambleAlgorithm).toBe('3')
    })

    test('selects the matching algorithm-2 xorshift candidate', () => {
        const seed = 84
        const encoded = encodeXorshift(png, seed | 1)
        const result = decodeComixProtectedImage(
            Buffer.from(encoded).toString('base64'),
            {
                'x-enc-seed': String(seed),
                'x-enc-len': String(encoded.length),
                'x-enc-algo': '2'
            }
        )

        expect(Buffer.from(result.imageBase64, 'base64')).toEqual(Buffer.from(png))
        expect(result.shouldDescrambleGrid).toBe(false)
    })

    test('rejects protected bytes that do not decode to an image', () => {
        expect(() => decodeComixProtectedImage(
            Buffer.from('not an image').toString('base64'),
            {}
        )).toThrow('invalid protected image data')
    })

    test('uses the raw seed for unknown rotating scramble hashes', () => {
        const webp = Uint8Array.from([
            0x52, 0x49, 0x46, 0x46,
            0x00, 0x00, 0x00, 0x00,
            0x57, 0x45, 0x42, 0x50
        ])

        const result = decodeComixProtectedImage(
            Buffer.from(webp).toString('base64'),
            {
                'x-scramble-seed': '1699447422',
                'x-scramble-grid': '5x5',
                'x-scramble-algo': '3',
                'x-scramble-hash': 'c082e'
            }
        )

        expect(result.shouldDescrambleGrid).toBe(true)
        expect(result.scrambleSeed).toBe(1_699_447_422)
        expect(result.scrambleAlgorithm).toBe('3')
    })
})
