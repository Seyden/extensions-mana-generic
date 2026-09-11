import {
    NetworkClientBuilder,
    NetworkRequest,
    WebViewPageFactory,
    WebViewPageInstance
} from '@mana-app/types'
import {
    ComixChapter,
    ComixHomeData,
    ComixManga,
    ComixPagedResponse,
    ComixResolvedPage,
    ComixSearchLookups,
    ComixWebViewOperation,
    ComixWebViewPayload
} from '../ComixInterfaces'
import { COMIX_DOMAIN } from '../ComixInfo'
import {
    addComixV3Flag,
    ComixDecodedProtectedImage,
    decodeComixProtectedImage
} from './ComixDescrambler'
import { executeComixWebViewOperation } from './ComixWebViewOperation'

export interface ComixWebViewClientOptions {
    bundleTimeoutMs?: number
    pollIntervalMs?: number
    pageTimeoutSeconds?: number
}

interface ComixReaderPage {
    index?: number
    url?: string
    width?: number
    height?: number
    scrambled?: boolean
    raw?: string
}

interface ComixBundlePageSnapshot {
    state: 'main' | 'cloudflare' | 'waiting'
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    if (error && typeof error === 'object') {
        const value = error as Record<string, unknown>
        for (const key of ['message', 'localizedDescription', 'description']) {
            const candidate = value[key]
            if (typeof candidate === 'string' && candidate) {
                return candidate
            }
        }

        const domain = typeof value.domain === 'string' ? value.domain : ''
        const code = typeof value.code === 'number' ||
            typeof value.code === 'string'
            ? String(value.code)
            : ''
        if (domain || code) {
            return [domain, code && `code=${code}`].filter(Boolean).join(' ')
        }
    }
    return String(error)
}

export async function waitForComixMainBundle(
    page: WebViewPageInstance,
    timeoutMs: number,
    pollIntervalMs: number,
    resolutionUrl: string
): Promise<void> {
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeoutMs) {
        let snapshot: ComixBundlePageSnapshot | undefined
        try {
            snapshot = await page.evaluate(() => {
                const markers: string[] = []
                const hasMainBundle = Boolean(document.querySelector(
                    'script[type="module"][src*="/dist/main-"]'
                ))
                if (document.title === 'Just a moment...') {
                    markers.push('title')
                }
                if (document.querySelector('#challenge-error-text')) {
                    markers.push('error-text')
                }
                if (document.querySelector(
                    'script[src*="/cdn-cgi/challenge-platform/"]'
                )) {
                    markers.push('challenge-script')
                }
                if (typeof (globalThis as { _cf_chl_opt?: unknown })._cf_chl_opt !==
                    'undefined') {
                    markers.push('challenge-options')
                }

                return {
                    state: hasMainBundle
                        ? 'main'
                        : markers.length > 0
                            ? 'cloudflare'
                            : 'waiting'
                }
            }) as ComixBundlePageSnapshot
        } catch {
            // Navigation can temporarily invalidate the evaluation context.
        }

        if (snapshot?.state === 'main') return
        if (snapshot?.state === 'cloudflare') {
            throw new CloudflareError(resolutionUrl)
        }

        await delay(pollIntervalMs)
    }

    throw new Error('Timed out waiting for the Comix main bundle')
}

export function comixWebViewPath(
    fallbackPath: string,
    webUrl?: string
): string {
    if (!webUrl) return fallbackPath

    try {
        const url = new URL(webUrl, COMIX_DOMAIN)
        return url.origin === COMIX_DOMAIN
            ? `${url.pathname}${url.search}`
            : fallbackPath
    } catch {
        return fallbackPath
    }
}

export class ComixWebViewClient {
    private readonly factory?: WebViewPageFactory
    private readonly bundleTimeoutMs: number
    private readonly pollIntervalMs: number
    private readonly pageTimeoutSeconds: number
    private binaryClient?: NetworkClient

    constructor(
        factory?: WebViewPageFactory,
        options: ComixWebViewClientOptions = {},
        binaryClient?: NetworkClient
    ) {
        this.factory = factory
        this.bundleTimeoutMs = options.bundleTimeoutMs ?? 12_000
        this.pollIntervalMs = options.pollIntervalMs ?? 25
        this.pageTimeoutSeconds = options.pageTimeoutSeconds ?? 30
        this.binaryClient = binaryClient
    }

    getChapters(mangaId: string): Promise<ComixPagedResponse<ComixChapter>> {
        return this.execute<ComixPagedResponse<ComixChapter>>(
            `/title/${encodeURIComponent(mangaId)}`,
            'chapters',
            { mangaId }
        )
    }

    getChapterPages(
        mangaId: string,
        chapterId: string,
        chapterUrl?: string
    ): Promise<ComixResolvedPage[]> {
        const fallbackPath = `/title/${encodeURIComponent(mangaId)}`
        return this.execute<ComixResolvedPage[]>(
            comixWebViewPath(fallbackPath, chapterUrl),
            'chapter',
            { mangaId, chapterId }
        )
    }

    list(
        params: Record<string, unknown>,
        lookups: ComixSearchLookups = {}
    ): Promise<ComixPagedResponse<ComixManga>> {
        return this.execute<ComixPagedResponse<ComixManga>>(
            '/browse',
            'list',
            { params, lookups }
        )
    }

    getHome(params: Record<string, unknown> = {}): Promise<ComixHomeData> {
        return this.execute<ComixHomeData>('/', 'home', { params })
    }

    private getBinaryClient(): NetworkClient {
        if (!this.binaryClient) {
            this.binaryClient = new NetworkClientBuilder()
                .setRateLimit(5, 1)
                .setTimeout(30_000)
                .addHeader('Referer', `${COMIX_DOMAIN}/`)
                .addHeader(
                    'Accept',
                    'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5'
                )
                .build()
        }
        return this.binaryClient
    }

    private async fetchProtectedImage(
        url: string
    ): Promise<ComixDecodedProtectedImage> {
        const headers: Record<string, string> = {
            Referer: `${COMIX_DOMAIN}/`,
            Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache'
        }

        const request: NetworkRequest = {
            url,
            method: 'GET',
            responseEncoding: 'base64',
            headers,
            validateStatus: () => true
        }
        const response = await this.getBinaryClient().request(request)
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`CDN returned ${response.status} for ${request.url}`)
        }
        if (!response.data) {
            throw new Error(`CDN returned an empty body for ${request.url}`)
        }
        return decodeComixProtectedImage(response.data, response.headers)
    }

    private renderDecodedProtectedImage(
        page: WebViewPageInstance,
        readerPage: ComixReaderPage,
        decoded: ComixDecodedProtectedImage
    ): Promise<string> {
        return page.evaluate(
            async (
                imageBase64: string,
                expectedWidth: number,
                expectedHeight: number,
                scrambleSeed: number,
                scrambleAlgorithm: string | undefined,
                shouldDescrambleGrid: boolean
            ): Promise<string> => {
                const binary = atob(imageBase64)
                const bytes = new Uint8Array(binary.length)
                for (let index = 0; index < binary.length; index += 1) {
                    bytes[index] = binary.charCodeAt(index)
                }

                const objectUrl = URL.createObjectURL(new Blob([bytes]))
                let sourceCanvas: HTMLCanvasElement | undefined
                let outputCanvas: HTMLCanvasElement | undefined
                try {
                    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
                        const candidate = new Image()
                        candidate.onload = () => resolve(candidate)
                        candidate.onerror = () => reject(
                            new Error('Failed to decode decrypted Comix image data')
                        )
                        candidate.src = objectUrl
                    })
                    const width = image.naturalWidth || expectedWidth
                    const height = image.naturalHeight || expectedHeight
                    if (width <= 0 || height <= 0) {
                        throw new Error('Comix returned invalid protected image dimensions')
                    }

                    sourceCanvas = document.createElement('canvas')
                    sourceCanvas.width = width
                    sourceCanvas.height = height
                    const sourceContext = sourceCanvas.getContext('2d')
                    if (!sourceContext) {
                        throw new Error('Could not create the Comix source canvas')
                    }
                    sourceContext.drawImage(image, 0, 0, width, height)
                    let resultCanvas = sourceCanvas

                    if (shouldDescrambleGrid) {
                        outputCanvas = document.createElement('canvas')
                        outputCanvas.width = width
                        outputCanvas.height = height
                        const outputContext = outputCanvas.getContext('2d')
                        if (!outputContext) {
                            throw new Error('Could not create the Comix output canvas')
                        }
                        outputContext.drawImage(sourceCanvas, 0, 0)
                        resultCanvas = outputCanvas

                        const columns = 5
                        const rows = 5
                        const tileWidth = Math.floor(width / columns)
                        const tileHeight = Math.floor(height / rows)
                        if (tileWidth <= 0 || tileHeight <= 0) {
                            throw new Error('Comix returned an invalid scramble grid')
                        }

                        const shuffled = Array.from(
                            { length: columns * rows },
                            (_, index) => index
                        )
                        let state = scrambleAlgorithm === '3'
                            ? scrambleSeed | 1
                            : scrambleSeed | 0
                        for (let index = shuffled.length - 1; index > 0; index -= 1) {
                            if (scrambleAlgorithm === '3') {
                                state ^= state << 13
                                state ^= state >>> 17
                                state ^= state << 5
                                state |= 0
                            } else {
                                state = (
                                    Math.imul(state, 1_664_525) +
                                    1_013_904_223
                                ) | 0
                            }
                            const swapIndex = (state >>> 0) % (index + 1)
                            const value = shuffled[index]!
                            shuffled[index] = shuffled[swapIndex]!
                            shuffled[swapIndex] = value
                        }

                        const order = new Array<number>(shuffled.length)
                        for (let index = 0; index < shuffled.length; index += 1) {
                            order[shuffled[index]!] = index
                        }

                        for (let destination = 0; destination < order.length; destination += 1) {
                            const source = order[destination]!
                            const sourceColumn = source % columns
                            const sourceRow = Math.floor(source / columns)
                            const destinationColumn = destination % columns
                            const destinationRow = Math.floor(destination / columns)
                            outputContext.drawImage(
                                sourceCanvas,
                                sourceColumn * tileWidth,
                                sourceRow * tileHeight,
                                tileWidth,
                                tileHeight,
                                destinationColumn * tileWidth,
                                destinationRow * tileHeight,
                                tileWidth,
                                tileHeight
                            )
                        }
                    }

                    // Comix replaces the page realm's canvas exporter with a
                    // 1x1 PNG decoy. A blank same-origin iframe has pristine
                    // browser prototypes, so invoke its native implementation
                    // against our canvas before page scripts can patch it.
                    const cleanRealm = document.createElement('iframe')
                    cleanRealm.style.display = 'none'
                    cleanRealm.setAttribute('aria-hidden', 'true')
                    document.documentElement.appendChild(cleanRealm)
                    let dataUrl: string
                    try {
                        const nativeToDataURL =
                            cleanRealm.contentDocument
                                ?.createElement('canvas').toDataURL
                        if (!nativeToDataURL) {
                            throw new Error(
                                'Could not resolve the native canvas exporter'
                            )
                        }
                        dataUrl = nativeToDataURL.call(
                            resultCanvas,
                            'image/jpeg',
                            0.95
                        )
                    } finally {
                        cleanRealm.remove()
                    }
                    const separator = dataUrl.indexOf(',')
                    if (separator < 0) {
                        throw new Error('The Comix canvas did not produce a base64 image')
                    }
                    const base64 = dataUrl.slice(separator + 1)
                    if (base64.length < 1_024) {
                        throw new Error(
                            `Comix native canvas returned an empty placeholder ` +
                            `(${width}x${height}, ${base64.length} base64 characters)`
                        )
                    }
                    return base64
                } finally {
                    URL.revokeObjectURL(objectUrl)
                    if (sourceCanvas) {
                        sourceCanvas.width = 0
                        sourceCanvas.height = 0
                    }
                    if (outputCanvas) {
                        outputCanvas.width = 0
                        outputCanvas.height = 0
                    }
                }
            },
            decoded.imageBase64,
            readerPage.width ?? 0,
            readerPage.height ?? 0,
            decoded.scrambleSeed,
            decoded.scrambleAlgorithm,
            decoded.shouldDescrambleGrid
        )
    }

    private async renderWithSiteDecoder(
        page: WebViewPageInstance,
        readerPage: ComixReaderPage,
        requestUrls: string[],
        pageNumber: number
    ): Promise<string> {
        return page.evaluate(
            async (
                candidateUrls: string[],
                expectedWidth: number,
                expectedHeight: number,
                targetPageNumber: number
            ): Promise<string> => {
                type SiteDecoderResult = {
                    apply(canvas: HTMLCanvasElement): void
                }
                type SiteDecoder = (
                    url: string,
                    signal: AbortSignal
                ) => Promise<SiteDecoderResult>

                const decoderWindow = window as Window & {
                    __manaComixSiteDecoder?: SiteDecoder
                }
                let decoder = decoderWindow.__manaComixSiteDecoder
                if (!decoder) {
                    const mainScript = document.querySelector<HTMLScriptElement>(
                        'script[type="module"][src*="/dist/main-"]'
                    )
                    if (!mainScript?.src) {
                        throw new Error('Could not find the Comix main bundle for its image decoder')
                    }

                    const mainResponse = await fetch(mainScript.src)
                    if (!mainResponse.ok) {
                        throw new Error(
                            `Could not load the Comix main bundle for its image decoder ` +
                            `(${mainResponse.status})`
                        )
                    }
                    const mainJavaScript = await mainResponse.text()
                    const readerFile = mainJavaScript.match(
                        /import\(["']\.\/(ReadPage-[^"']+\.js)["']\)/
                    )?.[1]
                    if (!readerFile) {
                        throw new Error('Could not find the Comix reader bundle')
                    }

                    const readerUrl = new URL(readerFile, mainScript.src).href
                    const readerResponse = await fetch(readerUrl)
                    if (!readerResponse.ok) {
                        throw new Error(
                            `Could not load the Comix reader bundle (${readerResponse.status})`
                        )
                    }
                    const readerJavaScript = await readerResponse.text()
                    const secureImport = readerJavaScript.match(
                        /import\{([^}]+)\}from["']\.\/(secure-[^"']+\.js)["']/
                    )
                    if (!secureImport?.[1] || !secureImport[2]) {
                        throw new Error('Could not find the Comix secure decoder bundle')
                    }

                    const decoderLocalName = readerJavaScript.match(
                        /\}\)\(([$A-Z_a-z][$\w]*)\([^,()]+,\s*[$A-Z_a-z][$\w]*\.signal\)\)/
                    )?.[1]
                    const decoderExportName = secureImport[1]
                        .split(',')
                        .map((entry) => entry.trim().match(
                            /^([$\w]+)(?:\s+as\s+([$\w]+))?$/
                        ))
                        .find((entry) =>
                            entry &&
                            (entry[2] ?? entry[1]) === decoderLocalName
                        )?.[1] ?? 't'

                    const importBundle = new Function(
                        'url',
                        'return import(url)'
                    ) as (url: string) => Promise<Record<string, unknown>>
                    const secureModule = await importBundle(
                        new URL(secureImport[2], readerUrl).href
                    )
                    const resolvedDecoder = secureModule[decoderExportName]
                    if (typeof resolvedDecoder !== 'function') {
                        throw new Error('Could not resolve the Comix image decoder')
                    }
                    decoder = resolvedDecoder as SiteDecoder
                    decoderWindow.__manaComixSiteDecoder = decoder
                }

                let lastError = 'No Comix decoder URL was available'
                for (const candidateUrl of candidateUrls) {
                    const controller = new AbortController()
                    const timeout = window.setTimeout(
                        () => controller.abort(),
                        5_000
                    )
                    let canvas: HTMLCanvasElement | undefined
                    try {
                        const decoded = await (decoder as SiteDecoder)(
                            candidateUrl,
                            controller.signal
                        )
                        if (!decoded || typeof decoded.apply !== 'function') {
                            throw new Error(
                                'Comix decoder returned invalid image data'
                            )
                        }

                        const targetWidth = Number.isFinite(expectedWidth) &&
                            expectedWidth > 1
                            ? Math.floor(expectedWidth)
                            : 800
                        const targetHeight = Number.isFinite(expectedHeight) &&
                            expectedHeight > 1
                            ? Math.floor(expectedHeight)
                            : 1_200
                        canvas = document.createElement('canvas')
                        canvas.width = targetWidth
                        canvas.height = targetHeight
                        canvas.className = 'rpage-page__img'
                        canvas.setAttribute(
                            'aria-label',
                            `Page ${targetPageNumber}`
                        )
                        const pageContainer =
                            document.querySelector<HTMLElement>(
                                `.rpage-page[data-page="${targetPageNumber}"]`
                            )
                        const canvasParent = pageContainer ?? document.body
                        canvasParent.appendChild(canvas)
                        decoded.apply(canvas)
                        if (
                            canvas.width !== targetWidth ||
                            canvas.height !== targetHeight
                        ) {
                            throw new Error(
                                `Comix decoder returned ` +
                                `${canvas.width}x${canvas.height}; expected ` +
                                `${targetWidth}x${targetHeight}`
                            )
                        }

                        const cleanRealm = document.createElement('iframe')
                        cleanRealm.style.display = 'none'
                        cleanRealm.setAttribute('aria-hidden', 'true')
                        document.documentElement.appendChild(cleanRealm)
                        let dataUrl: string
                        try {
                            const nativeToDataURL =
                                cleanRealm.contentDocument
                                    ?.createElement('canvas').toDataURL
                            if (!nativeToDataURL) {
                                throw new Error(
                                    'Could not resolve the native canvas exporter'
                                )
                            }
                            dataUrl = nativeToDataURL.call(
                                canvas,
                                'image/jpeg',
                                0.95
                            )
                        } finally {
                            cleanRealm.remove()
                        }
                        const separator = dataUrl.indexOf(',')
                        if (separator < 0) {
                            throw new Error(
                                'Comix decoder did not produce a base64 image'
                            )
                        }
                        const base64 = dataUrl.slice(separator + 1)
                        if (base64.length < 1_024) {
                            throw new Error(
                                `Comix decoder returned an empty placeholder ` +
                                `(${base64.length} base64 characters)`
                            )
                        }
                        return base64
                    } catch (error) {
                        lastError = error instanceof Error
                            ? error.message
                            : String(error)
                    } finally {
                        window.clearTimeout(timeout)
                        if (canvas) {
                            canvas.remove()
                            canvas.width = 0
                            canvas.height = 0
                        }
                    }
                }

                throw new Error(
                    `The Comix site decoder failed after ` +
                    `${candidateUrls.length} attempts: ${lastError}`
                )
            },
            requestUrls,
            readerPage.width ?? 0,
            readerPage.height ?? 0,
            pageNumber
        )
    }

    private async renderProtectedImage(
        page: WebViewPageInstance,
        readerPage: ComixReaderPage,
        pageNumber: number
    ): Promise<string> {
        if (!readerPage.url) {
            throw new Error(`Comix protected page ${pageNumber} had no CDN URL`)
        }

        const cleanUrl = readerPage.url.split('#', 1)[0]!
        const requestUrl = addComixV3Flag(cleanUrl)
        const retryUrl = `${requestUrl}${requestUrl.includes('?') ? '&' : '?'}r=` +
            encodeURIComponent(`${Date.now()}-${pageNumber}`)
        const requestUrls = [requestUrl, retryUrl]
        let lastError = 'No Comix CDN URL was available'

        for (const candidateUrl of requestUrls) {
            try {
                const decoded = await this.fetchProtectedImage(candidateUrl)
                // The signature check in decodeComixProtectedImage is not enough:
                // a truncated PNG can still have a valid signature but fail its
                // IDAT CRC. Only accept bytes after WebKit decodes and redraws them.
                return await this.renderDecodedProtectedImage(
                    page,
                    readerPage,
                    decoded
                )
            } catch (error) {
                lastError = `${errorMessage(error)} for ${candidateUrl}`
                if (lastError.includes(
                    'Comix native canvas returned an empty placeholder'
                )) {
                    break
                }
            }
        }

        try {
            return await this.renderWithSiteDecoder(
                page,
                readerPage,
                requestUrls,
                pageNumber
            )
        } catch (error) {
            const siteError = errorMessage(error)
            throw new Error(
                `Failed to decode protected Comix page ${pageNumber}. ` +
                `Native decoder: ${lastError}. Site decoder: ${siteError}`
            )
        }
    }

    private async resolveChapterPages(
        page: WebViewPageInstance,
        value: unknown
    ): Promise<ComixResolvedPage[]> {
        if (!Array.isArray(value)) {
            throw new Error('Comix returned invalid reader page metadata')
        }

        const result: ComixResolvedPage[] = []
        for (let index = 0; index < value.length; index += 1) {
            const readerPage = value[index] as ComixReaderPage
            const pageNumber = (readerPage.index ?? index) + 1
            if (readerPage.raw) {
                result.push({ raw: readerPage.raw })
            } else if (readerPage.scrambled) {
                result.push({
                    raw: await this.renderProtectedImage(page, readerPage, pageNumber)
                })
            } else if (readerPage.url) {
                result.push({ url: readerPage.url })
            } else {
                throw new Error(`Comix page ${pageNumber} had no image data`)
            }
        }
        return result
    }

    private async execute<Result>(
        path: string,
        operation: ComixWebViewOperation,
        payload: ComixWebViewPayload
    ): Promise<Result> {
        // Resolve the Mana global lazily so metadata tooling can instantiate Target
        // in a plain JavaScript runtime where WebViewPage is intentionally absent.
        const factory = this.factory ?? WebViewPage
        const page = await factory.create({ timeout: this.pageTimeoutSeconds })
        const navigationUrl = `${COMIX_DOMAIN}${path}`

        try {
            try {
                await page.goto(
                    navigationUrl,
                    {
                        waitUntil: 'domcontentloaded',
                        timeout: this.pageTimeoutSeconds
                    }
                )
            } catch (error) {
                throw new Error(`Comix navigation failed: ${errorMessage(error)}`)
            }

            await waitForComixMainBundle(
                page,
                this.bundleTimeoutMs,
                this.pollIntervalMs,
                navigationUrl
            )

            const result = await page.evaluate(
                executeComixWebViewOperation,
                operation,
                payload
            )

            if (operation === 'chapter') {
                return await this.resolveChapterPages(page, result) as Result
            }
            return result as Result
        } finally {
            await page.close()
        }
    }
}
