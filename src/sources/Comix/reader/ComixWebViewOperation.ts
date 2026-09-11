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
        get(mangaId: string): Promise<unknown>
        chapters(mangaId: string, params?: PageRecord): Promise<PagePagedResponse>
        groups(mangaId: string): Promise<unknown>
    }
    type PageHttpApi = {
        get(path: string, options?: PageRecord): Promise<unknown>
        post(path: string, data?: unknown, options?: PageRecord): Promise<unknown>
        put(path: string, data?: unknown, options?: PageRecord): Promise<unknown>
        patch(path: string, data?: unknown, options?: PageRecord): Promise<unknown>
        delete(path: string, options?: PageRecord): Promise<unknown>
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

    const isMangaApi = (value: unknown): value is PageMangaApi => {
        if (!isRecord(value)) return false
        return isFunction(value.list) &&
            isFunction(value.top) &&
            isFunction(value.get) &&
            isFunction(value.chapters) &&
            isFunction(value.groups)
    }

    const isHttpApi = (value: unknown): value is PageHttpApi => {
        if (!isRecord(value)) return false
        return isFunction(value.get) &&
            isFunction(value.post) &&
            isFunction(value.put) &&
            isFunction(value.patch) &&
            isFunction(value.delete)
    }

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
    const environmentFile = mainJavaScript.match(
        /from\s*["']\.\/(env-[^"']+\.js)["']/
    )?.[1]
    if (!environmentFile) {
        throw new Error('Could not find the Comix environment bundle')
    }

    const importBundle = new Function(
        'url',
        'return import(url)'
    ) as (url: string) => Promise<PageRecord>
    const environment = await importBundle(
        new URL(environmentFile, mainScript.src).href
    )
    const mangaApi = Object.values(environment).find(isMangaApi)
    if (!mangaApi) {
        throw new Error('Could not find the Comix manga API')
    }

    if (requestedOperation === 'list') {
        const resolvedParams: PageRecord = { ...params }
        const hasLookups = lookups.tags.length > 0 ||
            lookups.authors.length > 0 ||
            lookups.artists.length > 0

        if (hasLookups) {
            const httpApi = Object.values(environment).find(isHttpApi)
            if (!httpApi) {
                throw new Error('Could not find the Comix authenticated HTTP client')
            }

            const resolveIds = async (
                type: 'tag' | 'author' | 'artist',
                names: string[]
            ): Promise<string[]> => {
                const responses = await Promise.all(names.map((name) =>
                    httpApi.get('/tags/search', {
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

    const httpApi = Object.values(environment).find(isHttpApi)
    if (!httpApi) {
        throw new Error('Could not find the Comix authenticated HTTP client')
    }
    const chapterResponse = await httpApi.get(`/chapters/${chapterId}`)
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
                ? `${pageBaseUrl.replace(/\/+$/, '')}/${rawPath.replace(/^\/+/, '')}`
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
