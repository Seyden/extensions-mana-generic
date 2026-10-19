import {
    HttpClient,
} from '@mana-app/types'
import {
    AtsumaruApi,
    createAtsumaruUrl,
    parseAtsumaruUrl
} from '../AtsumaruApi'

function clientReturning(status: number, data: string): HttpClient {
    return {
        get: jest.fn().mockResolvedValue({ status, json: async () => JSON.parse(data) })
    } as unknown as HttpClient
}

describe('AtsumaruApi', () => {
    test('builds and parses URLs without browser URL globals', () => {
        const globals = globalThis as unknown as Record<string, unknown>
        const originalUrl = globals.URL
        const originalSearchParams = globals.URLSearchParams
        delete globals.URL
        delete globals.URLSearchParams

        try {
            const url = createAtsumaruUrl('/api/test', {
                query: 'witch hat',
                adult: 1
            })
            expect(url).toBe('https://atsu.moe/api/test?query=witch%20hat&adult=1')
            expect(parseAtsumaruUrl(url)).toEqual({
                host: 'atsu.moe',
                pathname: '/api/test'
            })
        } finally {
            globals.URL = originalUrl
            globals.URLSearchParams = originalSearchParams
        }
    })

    test('parses valid JSON responses', async () => {
        const api = new AtsumaruApi(clientReturning(200, '{"genres":[]}'))
        await expect(api.getFilters()).resolves.toEqual({ genres: [] })
    })

    test('reports the endpoint when JSON is malformed', async () => {
        const api = new AtsumaruApi(clientReturning(200, 'not-json'))
        await expect(api.getFilters()).rejects.toThrow(
            'Atsumaru returned invalid JSON for https://atsu.moe/api/explore/availableFilters'
        )
    })

    test('reports unsuccessful response statuses', async () => {
        const api = new AtsumaruApi(clientReturning(503, '{}'))
        await expect(api.getFilters()).rejects.toThrow(
            'Atsumaru request failed (503)'
        )
    })
})
