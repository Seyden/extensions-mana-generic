import { SearchRequest } from '@mana-app/types'
import { ASURASCANS_API_DOMAIN } from './AsuraScansInfo'
import { loadJsonData } from './AsuraScansHelper'
import { ApiCollection, FilterProps, SeriesSearchItem, TrendingItem, TrendingPeriod } from './AsuraScansInterfaces'

export const SERIES_PAGE_LIMIT = 20

export function constructSearchUrl(offset: number, request: SearchRequest<FilterProps>): string {
    const latest = request.listId === 'latest_update'
    if (request.listId && !latest) throw new Error(`Unknown AsuraScans list: ${request.listId}`)
    const url = new URL('/api/series', ASURASCANS_API_DOMAIN)
    const filters = latest ? undefined : request.filters
    const parameters = {
        limit: String(SERIES_PAGE_LIMIT),
        offset: String(offset),
        search: latest ? undefined : request.query,
        status: filters?.status?.id,
        type: filters?.type?.id,
        sort: latest ? 'latest' : request.sort?.id ?? 'latest',
        order: !latest && request.sort?.ascending ? 'asc' : 'desc',
        genres: filters?.genres?.map(genre => genre.title.toLowerCase()).join(','),
        min_chapters: filters?.chapters?.id
    }
    for (const [key, value] of Object.entries(parameters)) {
        if (value) url.searchParams.set(key, value)
    }
    return url.href
}

export class AsuraScansApi {
    constructor(private readonly client: NetworkClient) {}

    getSeriesPage(request: SearchRequest<FilterProps>): Promise<ApiCollection<SeriesSearchItem>> {
        return this.getCollection(constructSearchUrl(((request.page ?? 1) - 1) * SERIES_PAGE_LIMIT, request))
    }

    getTrending(period: TrendingPeriod): Promise<ApiCollection<TrendingItem>> {
        return this.getCollection(`${ASURASCANS_API_DOMAIN}/api/trending/${period}?limit=20`)
    }

    private async getCollection<T>(url: string): Promise<ApiCollection<T>> {
        const response = await loadJsonData<ApiCollection<T>>(this.client, url)
        if (!response || !Array.isArray(response.data)) {
            throw new Error(`Missing data array in AsuraScans response: ${url}`)
        }
        return response
    }
}
