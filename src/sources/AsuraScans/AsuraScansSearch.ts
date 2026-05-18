import { PagedSearchResult, SearchFilter, SearchRequest, SortOption } from '@mana-app/types'
import { FilterProps, GenresResponse, orderOptions, SeriesSearchResponse } from './AsuraScansInterfaces'
import { getSelectValue, loadJsonData } from './AsuraScansHelper'
import { ASURASCANS_API_DOMAIN } from './AsuraScansInfo'
import { AsuraScansParser } from './AsuraScansParser'
import { URLBuilder } from './UrlBuilder'

const LIMIT = 20

export async function getSortOptions(): Promise<SortOption[]> {
    return orderOptions.map((option) => ({
        id: option.value,
        title: option.label,
        isDefault: option.value === 'latest',
        isOrderable: true
    }))
}

export async function getSearchFilters(client: NetworkClient, parser: AsuraScansParser): Promise<SearchFilter[]> {
    const { data: genres } = await loadJsonData<GenresResponse>(client, `${ASURASCANS_API_DOMAIN}/api/genres`)
    return parser.parseTags(genres ?? [])
}

export async function search(client: NetworkClient, parser: AsuraScansParser, searchRequest: SearchRequest<FilterProps>): Promise<PagedSearchResult> {
    const page: number = searchRequest?.page ?? 1
    const offset = (page - 1) * LIMIT

    const url = constructSearchUrl(offset, searchRequest)
    const { data, meta } = await loadJsonData<SeriesSearchResponse>(client, url)

    return {
        results: parser.parseSearchResults(data ?? []),
        isLastPage: offset + LIMIT >= (meta?.total ?? 0)
    }
}

export function constructSearchUrl(offset: number, query: SearchRequest<FilterProps>): string {
    let urlBuilder = new URLBuilder(ASURASCANS_API_DOMAIN)
        .addPathComponent('api/series')
        .addQueryParameter('limit', LIMIT.toString())
        .addQueryParameter('offset', offset.toString())

    if (query?.query) {
        urlBuilder = urlBuilder.addQueryParameter('name', encodeURIComponent(query.query))
    }

    const sort = getSelectValue(query?.filters?.order)
    urlBuilder = urlBuilder
        .addQueryParameter('status', getSelectValue(query?.filters?.status))
        .addQueryParameter('type', getSelectValue(query?.filters?.type))
        .addQueryParameter('sort', sort ?? 'latest')
        .addQueryParameter('order', 'desc')
        .addQueryParameter('genres', query.filters?.genres)
        .addQueryParameter('min_chapters', getSelectValue(query?.filters?.chapters))

    return urlBuilder.buildUrl({ addTrailingSlash: false, includeUndefinedParameters: false })
}
