import {
    HttpClient,
    HttpHeaders,
    WebViewPageFactory,
    WebViewPageInstance,
} from '@mana-app/types'
import {
    comixWebViewPath,
    ComixWebViewClient
} from '../reader/ComixWebView'
import { runInNewContext } from 'vm'
import { load } from 'cheerio'

const bundleSnapshot = (
    state: 'main' | 'cloudflare' | 'waiting',
    hasVisibleClearanceCookie = false
): object => ({
    state,
    url: 'https://comix.to/browse',
    title: state === 'cloudflare' ? 'Just a moment...' : 'Comix',
    readyState: 'complete',
    markers: state === 'cloudflare' ? ['title', 'challenge-script'] : [],
    hasVisibleClearanceCookie
})

function makeWebView(
    operationResult: unknown,
    operationError?: Error,
    navigationError?: Error,
    binaryClient?: HttpClient
): {
    client: ComixWebViewClient
    page: WebViewPageInstance
    create: jest.Mock
    evaluate: jest.Mock
    close: jest.Mock
    goto: jest.Mock
} {
    const evaluate = jest.fn()
        .mockResolvedValueOnce(bundleSnapshot('main'))
    if (operationError) {
        evaluate.mockRejectedValueOnce(operationError)
    } else {
        evaluate.mockResolvedValueOnce(operationResult)
    }

    const goto = navigationError
        ? jest.fn().mockRejectedValue(navigationError)
        : jest.fn().mockResolvedValue(undefined)
    const close = jest.fn().mockResolvedValue(undefined)
    const page = {
        goto,
        evaluate,
        evaluateScript: jest.fn(),
        close
    } as unknown as WebViewPageInstance
    const create = jest.fn().mockResolvedValue(page)
    const factory = { create } as unknown as WebViewPageFactory
    const client = new ComixWebViewClient(factory, {
        bundleTimeoutMs: 50,
        pollIntervalMs: 1,
        pageTimeoutSeconds: 15
    }, binaryClient)

    return { client, page, create, evaluate, close, goto }
}

describe('ComixWebViewClient', () => {
    test.each([
        ['block page', '<title>Attention Required! | Cloudflare</title><div id="cf-error-details">Sorry, you have been blocked</div>', 'Comix access blocked by Cloudflare'],
        ['challenge page', '<title>Just a moment...</title>', 'CloudflareError'],
        ['Cloudflare error page', '<title>Attention Required! | Cloudflare</title>', 'CloudflareError']
    ])('detects a %s immediately and closes the page', async (_, html, expected) => {
        const $ = load(html)
        const { client, evaluate, close } = makeWebView(undefined)
        evaluate.mockReset().mockImplementation((callback: () => unknown) =>
            runInNewContext(`(${callback.toString()})()`, {
                document: {
                    title: $('title').text(),
                    body: { textContent: $('body').text() },
                    querySelector: (selector: string) => $(selector).length ? {} : null
                }
            })
        )

        const request = client.list({ page: 1 })
        if (expected === 'CloudflareError') {
            await expect(request).rejects.toMatchObject({
                name: expected,
                resolutionURL: 'https://comix.to/browse'
            })
        } else {
            await expect(request).rejects.toThrow(expected)
        }
        expect(evaluate).toHaveBeenCalledTimes(1)
        expect(close).toHaveBeenCalledTimes(1)
    })

    test('uses only same-origin chapter URLs for WebView navigation', () => {
        expect(comixWebViewPath(
            '/title/20y95',
            'https://comix.to/title/20y95-futanari-whats-that/11126410-chapter-1'
        )).toBe(
            '/title/20y95-futanari-whats-that/11126410-chapter-1'
        )
        expect(comixWebViewPath(
            '/title/20y95',
            'https://example.com/not-comix'
        )).toBe('/title/20y95')
    })

    test('opens the chapter route before resolving reader pages', async () => {
        const result = [{ url: 'https://cdn.example/page-1.jpg' }]
        const { client, evaluate, goto } = makeWebView(result)
        const chapterUrl =
            'https://comix.to/title/20y95-futanari-whats-that/11126410-chapter-1'

        await expect(client.getChapterPages(
            '20y95',
            '11126410',
            chapterUrl
        )).resolves.toEqual(result)

        expect(goto).toHaveBeenCalledWith(
            chapterUrl,
            { waitUntil: 'domcontentloaded', timeout: 15 }
        )
        expect(evaluate).toHaveBeenLastCalledWith(
            expect.any(Function),
            'chapter',
            { mangaId: '20y95', chapterId: '11126410' }
        )
    })

    test('fetches V3 bytes without Origin and redraws scrambled pages locally', async () => {
        const imageBase64 = Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a
        ]).toString('base64')
        const request = jest.fn().mockResolvedValue({
            base64: async () => imageBase64,
            status: 200,
            ok: true,
            headers: new HttpHeaders({
                'x-scramble-seed': '321',
                'x-scramble-grid': '5x5',
                'x-scramble-algo': '3'
            }),
            request: {}
        })
        const binaryClient = { get: request } as unknown as HttpClient
        const { client, evaluate } = makeWebView([
            {
                index: 9,
                url: 'https://cdn.example/i5/page-10',
                width: 1280,
                height: 1808,
                scrambled: true
            }
        ], undefined, undefined, binaryClient)
        evaluate.mockResolvedValueOnce('decoded-jpeg-base64')

        await expect(client.getChapterPages(
            '20y95',
            '11126410'
        )).resolves.toEqual([{ raw: 'decoded-jpeg-base64' }])

        expect(request).toHaveBeenCalledWith('https://cdn.example/i5/page-10?v3', {
            headers: expect.objectContaining({
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache'
            })
        })
        expect(request.mock.calls[0]![1].headers).not.toHaveProperty('Origin')
        expect(evaluate).toHaveBeenLastCalledWith(
            expect.any(Function),
            imageBase64,
            1280,
            1808,
            321,
            '3',
            true
        )
    })

    test('cache-busts once after WebKit rejects the primary image', async () => {
        const validSignature = Buffer.from([
            0xff, 0xd8, 0xff, 0xe0
        ]).toString('base64')
        const request = jest.fn().mockResolvedValue({
            base64: async () => validSignature,
            status: 200,
            ok: true,
            headers: new HttpHeaders(),
            request: {}
        })
        const binaryClient = { get: request } as unknown as HttpClient
        const { client, evaluate } = makeWebView([
            {
                index: 9,
                url: 'https://cdn.example/i5/page-10',
                width: 1280,
                height: 1808,
                scrambled: true
            }
        ], undefined, undefined, binaryClient)
        evaluate
            .mockRejectedValueOnce(
                new Error('Failed to decode decrypted Comix image data')
            )
            .mockResolvedValueOnce('decoded-after-cache-bust')

        await expect(client.getChapterPages(
            '20y95',
            '11126410'
        )).resolves.toEqual([{ raw: 'decoded-after-cache-bust' }])
        expect(request).toHaveBeenCalledTimes(2)
        expect(request).toHaveBeenNthCalledWith(
            2,
            expect.stringMatching(/^https:\/\/cdn\.example\/i5\/page-10\?v3&r=/),
            expect.any(Object)
        )
    })

    test('keeps ordinary fourth pages on the normal URL path', async () => {
        const request = jest.fn()
        const binaryClient = { get: request } as unknown as HttpClient
        const { client, evaluate } = makeWebView([
            {
                index: 3,
                url: 'https://cdn.example/i5/page-4',
                width: 1280,
                height: 1808,
                scrambled: false
            }
        ], undefined, undefined, binaryClient)

        await expect(client.getChapterPages(
            '20y95',
            '11126410'
        )).resolves.toEqual([{ url: 'https://cdn.example/i5/page-4' }])
        expect(request).not.toHaveBeenCalled()
        expect(evaluate).toHaveBeenCalledTimes(2)
    })

    test('uses the current Comix site decoder after native attempts fail', async () => {
        const request = jest.fn().mockRejectedValue(new Error('offline CDN'))
        const binaryClient = { get: request } as unknown as HttpClient
        const { client, evaluate } = makeWebView([
            {
                index: 9,
                url: 'https://cdn.example/i5/page-10',
                width: 1280,
                height: 1808,
                scrambled: true
            }
        ], undefined, undefined, binaryClient)
        evaluate.mockResolvedValueOnce('decoded-by-site-module')

        await expect(client.getChapterPages(
            '20y95',
            '11126410'
        )).resolves.toEqual([{ raw: 'decoded-by-site-module' }])
        expect(request).toHaveBeenCalledTimes(2)
        expect(evaluate).toHaveBeenLastCalledWith(
            expect.any(Function),
            [
                'https://cdn.example/i5/page-10?v3',
                expect.stringMatching(
                    /^https:\/\/cdn\.example\/i5\/page-10\?v3&r=/
                )
            ],
            1280,
            1808,
            10
        )
    })

    test('decodes a rotated scramble hash natively using the raw seed', async () => {
        const webp = Buffer.from([
            0x52, 0x49, 0x46, 0x46,
            0x00, 0x00, 0x00, 0x00,
            0x57, 0x45, 0x42, 0x50
        ]).toString('base64')
        const request = jest.fn().mockResolvedValue({
            base64: async () => webp,
            status: 200,
            ok: true,
            headers: new HttpHeaders({
                'x-scramble-seed': '1699447422',
                'x-scramble-grid': '5x5',
                'x-scramble-algo': '3',
                'x-scramble-hash': 'c082e'
            }),
            request: {}
        })
        const binaryClient = { get: request } as unknown as HttpClient
        const { client, evaluate } = makeWebView([
            {
                index: 9,
                url: 'https://cdn.example/i5/page-10',
                width: 1280,
                height: 1808,
                scrambled: true
            }
        ], undefined, undefined, binaryClient)
        evaluate.mockResolvedValueOnce('decoded-rotated-hash')

        await expect(client.getChapterPages(
            '20y95',
            '11126410'
        )).resolves.toEqual([{ raw: 'decoded-rotated-hash' }])
        expect(request).toHaveBeenCalledTimes(1)
        expect(evaluate).toHaveBeenLastCalledWith(
            expect.any(Function),
            webp,
            1280,
            1808,
            1_699_447_422,
            '3',
            true
        )
    })

    test('reports a readable error returned by the site decoder', async () => {
        const request = jest.fn().mockRejectedValue(new Error('offline CDN'))
        const binaryClient = { get: request } as unknown as HttpClient
        const { client, evaluate, close } = makeWebView([
            {
                index: 9,
                url: 'https://cdn.example/i5/page-10',
                width: 1280,
                height: 1808,
                scrambled: true
            }
        ], undefined, undefined, binaryClient)
        evaluate.mockRejectedValueOnce(new Error('decoder timed out'))

        await expect(client.getChapterPages(
            '20y95',
            '11126410'
        )).rejects.toThrow('Site decoder: decoder timed out')
        expect(close).toHaveBeenCalledTimes(1)
    })

    test('navigates, evaluates, and closes a successful browse request', async () => {
        const result = {
            items: [{ hid: 'nn7xe', title: 'A Title' }],
            meta: { page: 1, lastPage: 1 }
        }
        const { client, create, evaluate, close, goto } = makeWebView(result)

        await expect(client.list(
            { page: 1 },
            { tags: ['Time Travel'] }
        )).resolves.toEqual(result)

        expect(create).toHaveBeenCalledWith({ timeout: 15 })
        expect(goto).toHaveBeenCalledWith(
            'https://comix.to/browse',
            { waitUntil: 'domcontentloaded', timeout: 15 }
        )
        expect(evaluate).toHaveBeenCalledTimes(2)
        expect(evaluate).toHaveBeenLastCalledWith(
            expect.any(Function),
            'list',
            {
                params: { page: 1 },
                lookups: { tags: ['Time Travel'] }
            }
        )
        expect(close).toHaveBeenCalledTimes(1)
    })

    test('waits for navigation before inspecting the page', async () => {
        let finishNavigation = (): void => {
            throw new Error('Navigation did not start')
        }
        const goto = jest.fn().mockImplementation(() =>
            new Promise<void>((resolve) => {
                finishNavigation = resolve
            })
        )
        const evaluate = jest.fn()
            .mockResolvedValueOnce(bundleSnapshot('main'))
            .mockResolvedValueOnce({ items: [], meta: {} })
        const close = jest.fn().mockResolvedValue(undefined)
        const page = {
            goto,
            evaluate,
            evaluateScript: jest.fn(),
            close
        } as unknown as WebViewPageInstance
        const factory = {
            create: jest.fn().mockResolvedValue(page)
        } as unknown as WebViewPageFactory
        const client = new ComixWebViewClient(factory)

        const request = client.list({ page: 1 })
        await Promise.resolve()

        expect(goto).toHaveBeenCalledTimes(1)
        expect(evaluate).not.toHaveBeenCalled()

        finishNavigation()
        await expect(request).resolves.toEqual({ items: [], meta: {} })
        expect(evaluate).toHaveBeenCalledTimes(2)
        expect(close).toHaveBeenCalledTimes(1)
    })

    test('closes the WebView when the in-page API operation fails', async () => {
        const { client, close } = makeWebView(
            undefined,
            new Error('Could not find the Comix manga API')
        )

        await expect(client.list({ page: 1 }))
            .rejects.toThrow('Could not find the Comix manga API')
        expect(close).toHaveBeenCalledTimes(1)
    })

    test('reports navigation errors and still closes the WebView', async () => {
        const { client, close } = makeWebView(
            undefined,
            undefined,
            new Error('offline')
        )

        await expect(client.list({ page: 1 }))
            .rejects.toThrow('Comix navigation failed: offline')
        expect(close).toHaveBeenCalledTimes(1)
    })

    test('times out when the main bundle never appears', async () => {
        const evaluate = jest.fn().mockResolvedValue(bundleSnapshot('waiting'))
        const close = jest.fn().mockResolvedValue(undefined)
        const page = {
            goto: jest.fn().mockResolvedValue(undefined),
            evaluate,
            evaluateScript: jest.fn(),
            close
        } as unknown as WebViewPageInstance
        const factory = {
            create: jest.fn().mockResolvedValue(page)
        } as unknown as WebViewPageFactory
        const client = new ComixWebViewClient(factory, {
            bundleTimeoutMs: 0,
            pollIntervalMs: 1
        })

        await expect(client.list({ page: 1 }))
            .rejects.toThrow('Timed out waiting for the Comix main bundle')
        expect(close).toHaveBeenCalledTimes(1)
    })

    test('reports a Cloudflare challenge as soon as it appears', async () => {
        const evaluate = jest.fn()
            .mockResolvedValueOnce(bundleSnapshot('waiting'))
            .mockResolvedValueOnce(bundleSnapshot('cloudflare'))
        const close = jest.fn().mockResolvedValue(undefined)
        const page = {
            goto: jest.fn().mockResolvedValue(undefined),
            evaluate,
            evaluateScript: jest.fn(),
            close
        } as unknown as WebViewPageInstance
        const factory = {
            create: jest.fn().mockResolvedValue(page)
        } as unknown as WebViewPageFactory
        const client = new ComixWebViewClient(factory, {
            bundleTimeoutMs: 50,
            pollIntervalMs: 1
        })

        await expect(client.list({ page: 1 })).rejects.toMatchObject({
            name: 'CloudflareError',
            resolutionURL: 'https://comix.to/browse'
        })
        expect(evaluate).toHaveBeenCalledTimes(2)
        expect(close).toHaveBeenCalledTimes(1)
    })
})
