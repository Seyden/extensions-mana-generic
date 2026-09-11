import {
    NetworkClientBuilder,
    NetworkRequest
} from '@mana-app/types'
import { load } from 'cheerio'
import {
    ComixBrowseOptions,
    ComixManga
} from './ComixInterfaces'
import { COMIX_DOMAIN } from './ComixInfo'

interface ComixInitialData {
    queries?: Record<string, unknown>
    list?: {
        options?: ComixBrowseOptions
    }
}

function parseInitialData(html: string): ComixInitialData {
    const $ = load(html)
    const value = $('#initial-data').text()
    if (!value) {
        throw new Error('Could not find Comix initial data')
    }

    try {
        return JSON.parse(value) as ComixInitialData
    } catch {
        throw new Error('Could not parse Comix initial data')
    }
}

export function parseComixTitleFromHtml(html: string, mangaId: string): ComixManga {
    const initialData = parseInitialData(html)
    const queries = initialData.queries ?? {}

    for (const [key, value] of Object.entries(queries)) {
        try {
            const query = JSON.parse(key) as unknown[]
            if (query[0] !== 'manga' || query[1] !== 'detail') continue

            const result = value && typeof value === 'object' && 'result' in value
                ? (value as { result: unknown }).result
                : value
            if (result && typeof result === 'object') {
                return result as ComixManga
            }
        } catch {
            // Ignore unrelated or malformed cached queries.
        }
    }

    throw new Error(`Could not find Comix title data for ${mangaId}`)
}

export function parseComixBrowseOptionsFromHtml(html: string): ComixBrowseOptions {
    const options = parseInitialData(html).list?.options
    if (!options) {
        throw new Error('Could not find Comix browse configuration')
    }
    return options
}

export class ComixHttpClient {
    private readonly client: NetworkClient

    constructor(client?: NetworkClient) {
        this.client = client ?? new NetworkClientBuilder()
            .setRateLimit(5, 1)
            .setTimeout(30_000)
            .addHeader('Referer', `${COMIX_DOMAIN}/`)
            .addHeader('Origin', COMIX_DOMAIN)
            .addHeader('Accept', 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8')
            .build()
    }

    async getManga(mangaId: string): Promise<ComixManga> {
        const html = await this.getHtml(`/title/${encodeURIComponent(mangaId)}`)
        return parseComixTitleFromHtml(html, mangaId)
    }

    async getBrowseOptions(): Promise<ComixBrowseOptions> {
        return parseComixBrowseOptionsFromHtml(await this.getHtml('/browse'))
    }

    private async getHtml(path: string): Promise<string> {
        const request: NetworkRequest = {
            url: `${COMIX_DOMAIN}${path}`,
            method: 'GET',
            // Let Comix attach the attempted URL to Cloudflare errors instead of
            // allowing the generic network validator to discard that context.
            validateStatus: (status) =>
                (status >= 200 && status < 400) ||
                status === 403 ||
                status === 503
        }
        const response = await this.client.request(request)
        if (response.status === 403 || response.status === 503) {
            throw new CloudflareError(request.url)
        }
        if (response.status < 200 || response.status >= 400) {
            throw new Error(`Comix request failed (${response.status}) for ${path}`)
        }
        if (typeof response.data !== 'string') {
            throw new Error(`Comix returned invalid HTML for ${path}`)
        }
        return response.data
    }
}
