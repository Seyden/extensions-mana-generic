import {
    NetworkClientBuilder,
    NetworkRequest
} from '@mana-app/types'
import {
    MANGADOT_DOMAIN,
    MangaDotChapter,
    MangaDotDetailsResponse,
    MangaDotFacets,
    MangaDotImagesResponse,
    MangaDotPagedResponse,
    MangaDotRelationsResponse,
    MangaDotSuggestionsResponse,
    MangaDotTagsResponse,
    MangaDotVolume
} from './MangaDotTypes'

function parseJson<T>(data: string, context: string): T {
    try {
        return JSON.parse(data) as T
    } catch {
        throw new Error(`MangaDot returned malformed JSON for ${context}`)
    }
}

export class MangaDotApi {
    private readonly client: NetworkClient

    constructor(client?: NetworkClient) {
        this.client = client ?? new NetworkClientBuilder()
            .setTimeout(30_000)
            .addHeader('Accept', 'application/json')
            .addHeader('Referer', `${MANGADOT_DOMAIN}/`)
            .addHeader('Origin', MANGADOT_DOMAIN)
            .build()
    }

    async getSection(section: string, page: number, limit: number): Promise<MangaDotPagedResponse> {
        const response = await this.getJson<MangaDotPagedResponse>(
            `/api/manga/section/${encodeURIComponent(section)}`,
            { page, limit, adult: 'both' },
            `section ${section}`
        )
        return this.pagedResponse(response, `section ${section}`)
    }

    async getSearch(url: string): Promise<MangaDotPagedResponse> {
        return this.pagedResponse(
            await this.getAbsoluteJson<MangaDotPagedResponse>(url, 'search'),
            'search'
        )
    }

    async getFacets(): Promise<MangaDotFacets> {
        const response = await this.getJson<MangaDotPagedResponse>(
            '/api/search',
            { facets: 1, limit: 1 },
            'search facets'
        )
        return response.facets ?? {}
    }

    async getTags(): Promise<MangaDotTagsResponse> {
        const response = await this.getJson<MangaDotTagsResponse>(
            '/api/manga/tags',
            { in_use: 1 },
            'tags'
        )
        if (response.categories != null && !Array.isArray(response.categories)) {
            throw new Error('MangaDot returned an invalid tag list')
        }
        return response
    }

    async getDetails(contentId: string): Promise<MangaDotDetailsResponse> {
        const response = await this.getJson<MangaDotDetailsResponse>(
            `/api/manga/${this.numericId(contentId)}`,
            {},
            'title details'
        )
        if (!response?.manga || typeof response.manga !== 'object') {
            throw new Error('MangaDot returned invalid title details')
        }
        return response
    }

    async getSuggestions(contentId: string): Promise<MangaDotSuggestionsResponse> {
        const response = await this.getJson<MangaDotSuggestionsResponse>(
            `/api/manga/${this.numericId(contentId)}/suggestions`,
            {},
            'suggestions'
        )
        if (response.suggestions != null && !Array.isArray(response.suggestions)) {
            throw new Error('MangaDot returned an invalid suggestion list')
        }
        return response
    }

    async getRelations(contentId: string): Promise<MangaDotRelationsResponse> {
        const response = await this.getJson<MangaDotRelationsResponse>(
            `/api/manga/${this.numericId(contentId)}/relations`,
            {},
            'relations'
        )
        const relations = response.relations
        const isInvalid = relations != null && (
            typeof relations !== 'object' ||
            (Array.isArray(relations) && relations.length > 0) ||
            (!Array.isArray(relations) && Object.values(relations).some((group) => !Array.isArray(group)))
        )
        if (isInvalid) throw new Error('MangaDot returned an invalid relation list')
        return response
    }

    async getChapters(contentId: string): Promise<MangaDotChapter[]> {
        const response = await this.getJson<MangaDotChapter[]>(
            `/api/manga/${this.numericId(contentId)}/chapters/list`,
            { lang: 'en' },
            'chapters'
        )
        if (!Array.isArray(response)) throw new Error('MangaDot returned an invalid chapter list')
        return response
    }

    async getVolumes(contentId: string): Promise<MangaDotVolume[]> {
        const response = await this.getJson<MangaDotVolume[]>(
            `/api/manga/${this.numericId(contentId)}/volumes`,
            { lang: 'en' },
            'volumes'
        )
        if (!Array.isArray(response)) throw new Error('MangaDot returned an invalid volume list')
        return response
    }

    async getImages(source: 'user' | 'scraper', id: string): Promise<MangaDotImagesResponse> {
        const segment = source === 'user' ? 'uploads' : 'chapters'
        const response = await this.getJson<MangaDotImagesResponse>(
            `/api/${segment}/${this.numericId(id)}/images`,
            {},
            'reader pages'
        )
        if (response.images != null && !Array.isArray(response.images)) {
            throw new Error('MangaDot returned an invalid image list')
        }
        return response
    }

    private numericId(id: string): string {
        if (!/^\d+$/.test(id)) {
            throw new Error(`Invalid MangaDot identifier: ${id}`)
        }
        return id
    }

    private pagedResponse(response: MangaDotPagedResponse, context: string): MangaDotPagedResponse {
        if (!response || typeof response !== 'object' ||
            (response.manga_list != null && !Array.isArray(response.manga_list))) {
            throw new Error(`MangaDot returned an invalid ${context} response`)
        }
        return response
    }

    private getJson<T>(
        path: string,
        params: Record<string, string | number>,
        context: string
    ): Promise<T> {
        const url = new URL(path, MANGADOT_DOMAIN)
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(key, String(value))
        })
        return this.getAbsoluteJson(url.href, context)
    }

    private async getAbsoluteJson<T>(url: string, context: string): Promise<T> {
        const request: NetworkRequest = {
            url,
            method: 'GET',
            validateStatus: (status) =>
                (status >= 200 && status < 300) ||
                status === 403 ||
                status === 404 ||
                status === 503
        }
        const response = await this.client.request(request)

        if (response.status === 403 || response.status === 503) {
            throw new CloudflareError(url)
        }
        if (response.status === 404) {
            throw new Error(`MangaDot could not find ${context}`)
        }
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`MangaDot request failed (${response.status}) for ${context}`)
        }

        return parseJson<T>(response.data, context)
    }
}
