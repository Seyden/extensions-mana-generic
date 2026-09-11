import { PagedSearchResult, SearchForm, SearchRequest, SortOption } from '@mana-app/types'
import { FilterProps, GenresResponse, orderOptions } from './AsuraScansInterfaces'
import { loadJsonData } from './AsuraScansHelper'
import { ASURASCANS_API_DOMAIN } from './AsuraScansInfo'
import { AsuraScansParser } from './AsuraScansParser'
import { AsuraScansApi, SERIES_PAGE_LIMIT } from './AsuraScansApi'
export { constructSearchUrl } from './AsuraScansApi'

export async function getSortOptions(): Promise<SortOption[]> {
    return orderOptions.map((option) => ({
        id: option.value,
        title: option.label,
        isDefault: option.value === 'latest',
        isOrderable: true
    }))
}

export async function getSearchForm(client: NetworkClient, parser: AsuraScansParser): Promise<SearchForm> {
    const { data: genres } = await loadJsonData<GenresResponse>(client, `${ASURASCANS_API_DOMAIN}/api/genres`)
    return parser.parseTags(genres ?? [])
}

export async function search(api: AsuraScansApi, parser: AsuraScansParser, searchRequest: SearchRequest<FilterProps>, baseUrl: string, fallbackImage: string): Promise<PagedSearchResult> {
    const page: number = searchRequest?.page ?? 1
    const offset = (page - 1) * SERIES_PAGE_LIMIT
    const { data, meta } = await api.getSeriesPage(searchRequest)
    const hasMore = meta?.has_more ?? (meta?.total != null
        ? offset + data.length < meta.total
        : data.length >= SERIES_PAGE_LIMIT)

    return {
        results: parser.parseSeriesItems(data, baseUrl, fallbackImage),
        isLastPage: !hasMore,
        totalResultCount: meta?.total
    }
}
