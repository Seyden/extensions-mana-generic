import { readFileSync } from 'fs'
import { join } from 'path'
import { runInNewContext } from 'vm'
import ts from 'typescript'

// Execute the serialized page operation, including discovery, rather than
// mocking WebView.evaluate and skipping all of its browser-side code.
const code = ts.transpileModule(readFileSync(join(
    __dirname, '../reader/ComixWebViewOperation.ts'
), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText

function harness(options: { missing?: boolean; badBundle?: boolean; renamed?: boolean } = {}) {
    const request = jest.fn().mockResolvedValue({ items: [], meta: { lastPage: 1 } })
    const underlying = Object.fromEntries(['get', 'post', 'put', 'patch', 'delete'].map(verb => [
        verb, async (...args: unknown[]) => ({ data: await request(verb, ...args) })
    ]))
    // Same structure as Comix's current wrapper, with arbitrary export/method names.
    const wrapper = new Function('client', `return {
        alpha: async(a,b)=>(await client.get(a,b)).data,
        beta: async(a,b,c)=>(await client.post(a,b,c)).data,
        gamma: async(a,b,c)=>(await client.put(a,b,c)).data,
        delta: async(a,b,c)=>(await client.patch(a,b,c)).data,
        epsilon: async(a,b)=>(await client.delete(a,b)).data
    }`)(underlying)
    const base = 'https://comix.to/assets/build/current/dist/'
    const moduleName = options.renamed ? 'next-build-X9.js' : 'tmq6ux-QgOrPl2t.js'
    const importBundle = jest.fn().mockResolvedValue(options.missing
        ? { unrelated: {} }
        : { changedExportName: wrapper, decoy: { get: () => null } })
    const fetch = jest.fn(async (url: string) => ({
        ok: !(options.badBundle && url.endsWith(moduleName)),
        status: options.badBundle ? 503 : 200,
        text: async () => url.endsWith('main-build.js')
            ? `import{x}from"./vendor.js";import{q}from"./${moduleName}";`
            : url.endsWith(moduleName) ? 'baseURL:"/api/v1";top:"/manga/top"' : 'vendor'
    }))
    const exports: Record<string, any> = {}
    runInNewContext(code, {
        exports, fetch, URL,
        window: { location: { origin: 'https://comix.to' } },
        document: { querySelector: () => ({ src: base + 'main-build.js' }) },
        Function: new Proxy(Function, {
            construct: () => importBundle
        })
    })
    return { run: exports.executeComixWebViewOperation, request, importBundle, base, moduleName }
}

describe('Comix in-page API discovery', () => {
    test.each([false, true])('discovers renamed bundles/exports/methods (renamed=%s)', async renamed => {
        const { run, request, importBundle, base, moduleName } = harness({ renamed })
        const result = { items: [{ hid: 'abc', title: 'Example' }], meta: { page: 2 } }
        request.mockResolvedValue(result)
        await expect(run('list', { params: { page: 2, genres_in: ['6'] } })).resolves.toEqual(result)
        expect(importBundle).toHaveBeenCalledTimes(1)
        expect(importBundle).toHaveBeenCalledWith(base + moduleName)
        expect(request).toHaveBeenCalledWith('get', '/manga', { params: { page: 2, genres_in: ['6'] } })
    })

    test('routes all home sections through the authenticated wrapper without rating defaults', async () => {
        const { run, request } = harness()
        await run('home', {})
        expect(request.mock.calls.map(call => call[1])).toEqual(['/manga/top', '/manga/top', '/manga', '/manga'])
        for (const call of request.mock.calls) expect(call[2].params).not.toHaveProperty('content_rating')
    })

    test('preserves readable chapter data and paginates through the wrapper', async () => {
        const { run, request } = harness()
        request.mockImplementation(async (_verb, _path, { params }) => ({
            items: [{ id: params.page, number: params.page, group: { id: 2, name: 'Group' } }],
            meta: { lastPage: 3 }
        }))
        const result = await run('chapters', { mangaId: 'abc' })
        expect(result.items.map((item: { id: number }) => item.id)).toEqual([1, 2, 3])
        expect(result.meta.pagesFetched).toBe(3)
        expect(request).toHaveBeenCalledWith('get', '/manga/abc/chapters', { params: { page: 1, limit: 100, order: { number: 'desc' } } })
    })

    test('resolves filter names through the same client', async () => {
        const { run, request } = harness()
        request.mockImplementation(async (_verb, path) => path === '/tags/search' ? [{ id: 9 }] : { items: [] })
        await run('list', { params: {}, lookups: { authors: ['Example'] } })
        expect(request).toHaveBeenCalledWith('get', '/manga', { params: { authors: ['9'] } })
    })

    test('normalizes packed reader pages from the raw HTTP response', async () => {
        const { run, request } = harness()
        request.mockResolvedValue({ pages: { baseUrl: 'https://cdn.example/pages/', items: [{ url: '1.jpg', width: 800, height: 1200 }] } })
        const pages = await run('chapter', { chapterId: '123' })
        expect(request).toHaveBeenCalledWith('get', '/chapters/123', undefined)
        expect(pages[0]).toMatchObject({ url: 'https://cdn.example/pages/1.jpg', width: 800, height: 1200 })
    })

    test('fails clearly when no wrapper is exported', async () => {
        const { run } = harness({ missing: true })
        await expect(run('home', {})).rejects.toThrow('Could not discover the Comix authenticated HTTP wrapper')
    })

    test('concatenates packed URL prefixes exactly as the site does', async () => {
        const { run, request } = harness()
        request.mockResolvedValue({ pages: {
            baseUrl: 'https://cdn.example/hi/shared-token-',
            items: [{ url: 'page-token' }, { url: 'https://other.example/page.jpg' }]
        } })
        const pages = await run('chapter', { chapterId: '123' })
        expect(pages.map((page: { url: string }) => page.url)).toEqual([
            'https://cdn.example/hi/shared-token-page-token',
            'https://other.example/page.jpg'
        ])
    })

    test('includes bundle fetch failures in discovery errors', async () => {
        const { run } = harness({ badBundle: true })
        await expect(run('home', {})).rejects.toThrow('HTTP 503')
    })

    test('propagates authenticated request errors without switching to plain fetch', async () => {
        const { run, request } = harness()
        request.mockRejectedValue(new Error('authentication failed'))
        await expect(run('list', {})).rejects.toThrow('authentication failed')
        expect(request).toHaveBeenCalledTimes(1)
    })
})
