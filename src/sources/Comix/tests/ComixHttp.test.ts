import {
    HttpClient,
} from '@mana-app/types'
import {
    ComixHttpClient,
    parseComixBrowseOptionsFromHtml,
    parseComixTitleFromHtml
} from '../ComixHttp'


function page(initialData: unknown): string {
    return `<html><body><script id="initial-data">${JSON.stringify(initialData)}</script></body></html>`
}

describe('Comix HTTP parser', () => {
    test('extracts title details without a WebView', () => {
        const manga = parseComixTitleFromHtml(page({
            queries: {
                '["manga","detail","abc"]': {
                    hid: 'abc',
                    title: 'HTTP Title'
                },
                '["manga","groups","abc"]': []
            }
        }), 'abc')

        expect(manga).toEqual({
            hid: 'abc',
            title: 'HTTP Title'
        })
    })

    test('extracts browse filter configuration from initial data', () => {
        const options = parseComixBrowseOptionsFromHtml(page({
            list: {
                options: {
                    genres: [{ id: 6, label: 'Action' }],
                    formats: [{ id: 93170, label: 'Long Strip' }]
                }
            }
        }))

        expect(options.genres?.[0]).toEqual({ id: 6, label: 'Action' })
        expect(options.formats?.[0]).toEqual({ id: 93170, label: 'Long Strip' })
    })

    test.each([403, 503])(
        'preserves the resolution URL for Cloudflare status %i',
        async (status) => {
            const request = jest.fn().mockImplementation(
                async () => {
                    return { status, data: '', headers: {} }
                }
            )
            const client = new ComixHttpClient({
                get: request
            } as unknown as HttpClient)

            await expect(client.getManga('abc')).rejects.toMatchObject({
                name: 'CloudflareError',
                resolutionURL: 'https://comix.to/title/abc'
            })
        }
    )
})
