import {
    NetworkClientBuilder
} from '@mana-app/types'
import {
    AtsumaruBrowseResponse,
    AtsumaruChapterResponse,
    AtsumaruChaptersResponse,
    AtsumaruFilterData,
    AtsumaruMangaResponse,
    AtsumaruSearchResponse
} from './AtsumaruTypes'

const simpleUrl = require('simple-url')

export const ATSUMARU_BASE_URL = 'https://atsu.moe'
export const ATSUMARU_LANGUAGE = 'en_US'
export const ATSUMARU_ICON_URL =
    `${ATSUMARU_BASE_URL}/favicon/apple-touch-icon-180x180.png`
export const ATSUMARU_HOST = 'atsu.moe'

type QueryValue = string | number | boolean | undefined

export interface AtsumaruParsedUrl {
    host: string
    pathname: string
}

export function createAtsumaruUrl(
    pathname: string,
    query: Record<string, QueryValue> = {}
): string {
    const definedQuery = Object.keys(query).reduce<Record<string, string | number | boolean>>(
        (result, key) => {
            const value = query[key]
            if (value !== undefined) result[key] = value
            return result
        },
        {}
    )

    return simpleUrl.create({
        protocol: 'https',
        host: ATSUMARU_HOST,
        pathname,
        query: definedQuery
    }) as string
}

export function parseAtsumaruUrl(value: string): AtsumaruParsedUrl | undefined {
    try {
        const parsed = simpleUrl.parse(value)
        if (!parsed?.host || !parsed.pathname) return undefined
        return {
            host: `${parsed.host}`.toLowerCase(),
            pathname: `${parsed.pathname}`
        }
    } catch {
        return undefined
    }
}

function absoluteAtsumaruUrl(value: string): string {
    if (/^https?:\/\//i.test(value)) return value
    return `${ATSUMARU_BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`
}

export class AtsumaruApi {
    private readonly client: NetworkClient

    constructor(client?: NetworkClient) {
        this.client = client ?? new NetworkClientBuilder()
            .setRateLimit(10, 1)
            .setTimeout(20_000)
            .addHeader('Accept', 'application/json')
            .addHeader('Referer', `${ATSUMARU_BASE_URL}/`)
            .build()
    }

    getFilters(): Promise<AtsumaruFilterData> {
        return this.get('/api/explore/availableFilters')
    }

    getManga(mangaId: string): Promise<AtsumaruMangaResponse> {
        return this.get(`/api/manga/page?id=${encodeURIComponent(mangaId)}`)
    }

    getChapters(mangaId: string): Promise<AtsumaruChaptersResponse> {
        return this.get(
            `/api/manga/allChapters?mangaId=${encodeURIComponent(mangaId)}`
        )
    }

    getChapter(
        mangaId: string,
        chapterId: string
    ): Promise<AtsumaruChapterResponse> {
        return this.get(createAtsumaruUrl('/api/read/chapter', {
            mangaId,
            chapterId
        }))
    }

    getBrowse(url: string): Promise<AtsumaruBrowseResponse> {
        return this.get(url)
    }

    getSearch(url: string): Promise<AtsumaruSearchResponse> {
        return this.get(url)
    }

    private async get<T>(url: string): Promise<T> {
        const absoluteUrl = absoluteAtsumaruUrl(url)
        const response = await this.client.get(absoluteUrl)

        if (response.status < 200 || response.status >= 300) {
            throw new Error(
                `Atsumaru request failed (${response.status}) for ${absoluteUrl}`
            )
        }

        try {
            const parsed = JSON.parse(response.data) as unknown
            if (!parsed || typeof parsed !== 'object') {
                throw new Error('response is not an object')
            }
            return parsed as T
        } catch (error) {
            const reason = error instanceof Error ? error.message : 'invalid JSON'
            throw new Error(`Atsumaru returned invalid JSON for ${absoluteUrl}: ${reason}`)
        }
    }
}
