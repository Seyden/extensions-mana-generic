import {
    ComixWebViewOperation,
    ComixWebViewPayload
} from '../ComixInterfaces'

/**
 * Runs inside the Comix page realm. Keep this function self-contained: values
 * from the source runtime are unavailable after WebViewPage serializes it.
 */
export async function executeComixWebViewOperation(
    requestedOperation: ComixWebViewOperation,
    requestedPayload: ComixWebViewPayload
): Promise<unknown> {
    type PageRecord = Record<string, unknown>
    type PagePagedResponse = {
        items?: unknown[]
        meta?: {
            total?: number
            perPage?: number
            page?: number
            lastPage?: number
            from?: number
            to?: number
            hasNext?: boolean
            hasPrev?: boolean
            pagesFetched?: number
        }
    }
    type PageMangaApi = {
        list(params?: PageRecord): Promise<unknown>
        top(params?: PageRecord): Promise<unknown>
        chapters(mangaId: string, params?: PageRecord): Promise<PagePagedResponse>
    }
    type PageHttpApi = {
        get(path: string, options?: PageRecord): Promise<unknown>
    }
    type PageItem = {
        url?: unknown
        raw?: unknown
        width?: unknown
        height?: unknown
        s?: unknown
        scramble?: unknown
    }

    const isRecord = (value: unknown): value is PageRecord =>
        typeof value === 'object' && value !== null && !Array.isArray(value)

    const isFunction = (value: unknown): value is (...args: never[]) => unknown =>
        typeof value === 'function'

    const payloadRecord = isRecord(requestedPayload) ? requestedPayload : {}
    const mangaId = typeof payloadRecord.mangaId === 'string'
        ? payloadRecord.mangaId
        : ''
    const chapterId = typeof payloadRecord.chapterId === 'string'
        ? payloadRecord.chapterId
        : ''
    const params = isRecord(payloadRecord.params) ? payloadRecord.params : {}
    const lookupRecord = isRecord(payloadRecord.lookups)
        ? payloadRecord.lookups
        : {}
    const stringArray = (value: unknown): string[] =>
        Array.isArray(value)
            ? value.filter((item): item is string => typeof item === 'string')
            : []
    const lookups = {
        tags: stringArray(lookupRecord.tags),
        authors: stringArray(lookupRecord.authors),
        artists: stringArray(lookupRecord.artists)
    }

    const mainScript = document.querySelector<HTMLScriptElement>(
        'script[type="module"][src*="/dist/main-"]'
    )
    if (!mainScript?.src) {
        throw new Error('Could not find the Comix main bundle')
    }

    const mainResponse = await fetch(mainScript.src)
    if (!mainResponse.ok) {
        throw new Error(`Could not load the Comix main bundle (${mainResponse.status})`)
    }
    const mainJavaScript = await mainResponse.text()
    const importBundle = new Function(
        'url',
        'return import(url)'
    ) as (url: string) => Promise<PageRecord>

    // Follow module imports, not build-specific filenames such as env-*.js.
    const bundleUrls = [...new Set(Array.from(
        mainJavaScript.matchAll(/\bfrom\s*["'](\.\/[^"']+\.js)["']/g),
        (match) => new URL(match[1]!, mainScript.src).href
    ))]
    let httpApi: PageHttpApi | undefined
    const failures: string[] = []
    for (let start = 0; start < bundleUrls.length && !httpApi; start += 4) {
        const bundles = await Promise.all(bundleUrls.slice(start, start + 4).map(async (url) => {
            try {
                const response = await fetch(url)
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return { url, code: await response.text() }
            } catch (error) {
                failures.push(`${url}: ${String(error)}`)
                return undefined
            }
        }))
        for (const bundle of bundles) {
            if (!bundle || !bundle.code.includes('/api/v1') ||
                !bundle.code.includes('/manga/top')) continue

            // Import the original module so its client retains Comix's security
            // interceptors. Never recreate or evaluate a copied client definition.
            const module = await importBundle(bundle.url)
            for (const value of Object.values(module)) {
                if (!isRecord(value)) continue
                const methods = new Map<string, { key: string; client: string }>()
                for (const [key, method] of Object.entries(value)) {
                    if (!isFunction(method)) continue
                    const match = Function.prototype.toString.call(method).match(
                        /\(\s*await\s+([$\w]+)\.(get|post|put|patch|delete)\s*\([^)]*\)\s*\)\s*\.data\b/
                    )
                    if (match) methods.set(match[2]!, { key, client: match[1]! })
                }
                const get = methods.get('get')
                if (!get || !['post', 'put', 'patch', 'delete'].every(
                    (verb) => methods.get(verb)?.client === get.client
                )) continue
                const method = value[get.key] as PageHttpApi['get']
                httpApi = { get: (path, options) => method.call(value, path, options) }
                break
            }
            if (httpApi) break
        }
    }
    if (!httpApi) {
        throw new Error('Could not discover the Comix authenticated HTTP wrapper' +
            (failures.length ? `; bundle loading failed: ${failures.join('; ')}` : ''))
    }
    const client = httpApi
    // The HTTP wrapper returns readable API fields. The site's manga wrapper
    // now converts them into build-specific names, so call the endpoints directly.
    const mangaApi: PageMangaApi = {
        list: (params) => client.get('/manga', { params }),
        top: (params) => client.get('/manga/top', { params }),
        chapters: async (id, params) => {
            const response = await client.get(`/manga/${encodeURIComponent(id)}/chapters`, { params })
            if (!isRecord(response) || !Array.isArray(response.items)) {
                throw new Error('Comix returned invalid chapter list data')
            }
            return response as PagePagedResponse
        }
    }

    if (requestedOperation === 'list') {
        const resolvedParams: PageRecord = { ...params }
        const hasLookups = lookups.tags.length > 0 ||
            lookups.authors.length > 0 ||
            lookups.artists.length > 0

        if (hasLookups) {
            const resolveIds = async (
                type: 'tag' | 'author' | 'artist',
                names: string[]
            ): Promise<string[]> => {
                const responses = await Promise.all(names.map((name) =>
                    client.get('/tags/search', {
                        params: { type, q: name }
                    })
                ))
                const ids = responses.flatMap((response) => {
                    const items = Array.isArray(response)
                        ? response
                        : isRecord(response) && Array.isArray(response.result)
                            ? response.result
                            : []
                    return items.flatMap((item) =>
                        isRecord(item) &&
                        (typeof item.id === 'number' || typeof item.id === 'string')
                            ? [`${item.id}`]
                            : []
                    )
                })
                return [...new Set(ids)]
            }

            const [tagIds, authorIds, artistIds] = await Promise.all([
                resolveIds('tag', lookups.tags),
                resolveIds('author', lookups.authors),
                resolveIds('artist', lookups.artists)
            ])
            if (tagIds.length > 0) {
                const included = stringArray(resolvedParams.genres_in)
                const excluded = stringArray(resolvedParams.genres_ex)
                    .filter((id) => !tagIds.includes(id))
                resolvedParams.genres_in = [...new Set([...included, ...tagIds])]
                if (excluded.length > 0) {
                    resolvedParams.genres_ex = excluded
                } else {
                    delete resolvedParams.genres_ex
                }
            }
            if (authorIds.length > 0) resolvedParams.authors = authorIds
            if (artistIds.length > 0) resolvedParams.artists = artistIds
        }

        return mangaApi.list(resolvedParams)
    }

    if (requestedOperation === 'home') {
        const [trending, mostFollowed, latest, recentlyAdded] = await Promise.all([
            mangaApi.top({
                ...params,
                type: 'trending',
                days: 1,
                limit: 30
            }),
            mangaApi.top({
                ...params,
                type: 'follows',
                days: 1,
                limit: 30
            }),
            mangaApi.list({
                ...params,
                scope: 'hot',
                order: { chapter_updated_at: 'desc' },
                page: 1,
                limit: 30
            }),
            mangaApi.list({
                ...params,
                order: { created_at: 'desc' },
                page: 1,
                limit: 30
            })
        ])

        return {
            trending,
            mostFollowed,
            latest,
            recentlyAdded
        }
    }

    if (requestedOperation === 'chapters') {
        if (!mangaId) throw new Error('Missing Comix manga ID')

        const getPage = (pageNumber: number) => mangaApi.chapters(mangaId, {
            page: pageNumber,
            limit: 100,
            order: { number: 'desc' }
        })
        const firstPage = await getPage(1)
        const firstMeta = firstPage.meta ?? {}
        const lastPage = firstMeta.lastPage ?? (
            firstMeta.total && firstMeta.perPage
                ? Math.ceil(firstMeta.total / firstMeta.perPage)
                : 1
        )
        const maximumPages = 250
        if (!Number.isFinite(lastPage) || lastPage < 1 || lastPage > maximumPages) {
            throw new Error(
                `Comix chapter pagination exceeded the ${maximumPages}-page safety limit`
            )
        }
        const responses: PagePagedResponse[] = [firstPage]
        const concurrency = 4

        for (let start = 2; start <= lastPage; start += concurrency) {
            const pageNumbers = Array.from(
                { length: Math.min(concurrency, lastPage - start + 1) },
                (_, index) => start + index
            )
            responses.push(...await Promise.all(pageNumbers.map(getPage)))
        }

        return {
            items: responses.flatMap((response) => response.items ?? []),
            meta: {
                ...firstMeta,
                pagesFetched: responses.length
            }
        }
    }

    if (requestedOperation !== 'chapter') {
        throw new Error(`Unsupported Comix WebView operation: ${requestedOperation}`)
    }
    if (!chapterId) throw new Error('Missing Comix chapter ID')

    const chapterResponse = await client.get(`/chapters/${encodeURIComponent(chapterId)}`)
    if (!isRecord(chapterResponse)) {
        throw new Error(`Comix returned invalid reader data for chapter ${chapterId}`)
    }

    const pagesValue = chapterResponse.pages
    let pageItems: unknown[] = []
    let pageBaseUrl = ''
    if (Array.isArray(pagesValue)) {
        pageItems = pagesValue
    } else if (isRecord(pagesValue) && Array.isArray(pagesValue.items)) {
        pageItems = pagesValue.items
        pageBaseUrl = typeof pagesValue.baseUrl === 'string'
            ? pagesValue.baseUrl
            : ''
    }
    if (pageItems.length === 0) {
        throw new Error(`Comix returned no pages for chapter ${chapterId}`)
    }

    return pageItems.map((item, index) => {
        if (typeof item === 'string') {
            return {
                index,
                url: new URL(item, window.location.origin).href,
                width: 0,
                height: 0,
                scrambled: false,
                raw: undefined
            }
        }

        const page = isRecord(item) ? item as PageItem : {}
        const rawPath = typeof page.url === 'string' ? page.url : ''
        const combinedPath = /^https?:\/\//i.test(rawPath)
            ? rawPath
            : pageBaseUrl
                // Comix treats baseUrl as an exact prefix, not a directory.
                ? `${pageBaseUrl}${rawPath}`
                : rawPath
        const resolvedUrl = combinedPath
            ? new URL(combinedPath, window.location.origin).href
            : ''
        const scrambleFlag = Number(page.s ?? page.scramble)
        const explicitlyScrambled = page.s === true ||
            page.scramble === true ||
            scrambleFlag === 1
        const urlUsesV3 = /[?&]v3(?:[=&]|$)/.test(resolvedUrl)
        const usesV3 = explicitlyScrambled || urlUsesV3
        const width = Number(page.width)
        const height = Number(page.height)

        return {
            index,
            url: resolvedUrl,
            width: Number.isFinite(width) ? width : 0,
            height: Number.isFinite(height) ? height : 0,
            scrambled: usesV3,
            raw: typeof page.raw === 'string' ? page.raw : undefined
        }
    })
}
