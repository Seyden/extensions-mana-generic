import {
    ContentRating,
    Option,
    SearchExcludableMultiPickerSheet,
    SearchForm,
    SearchListSection,
    SearchMultiPicker,
    SearchRequest,
    SearchSortSection,
    SearchStepper,
    SearchToggle,
    SectionStyle,
    SortOption
} from '@mana-app/types'
import { createAtsumaruUrl } from './AtsumaruApi'
import {
    AtsumaruContentRating,
    AtsumaruFilterData,
    AtsumaruFilterProps
} from './AtsumaruTypes'

export const ATSUMARU_PAGE_SIZE = 40
export const ATSUMARU_HOME_LIMIT = 15
type AtsumaruSourceContext = NonNullable<SearchRequest['context']>

const ATSUMARU_RATINGS: ReadonlyArray<{
    app: ContentRating
    api: AtsumaruContentRating
}> = [
    { app: ContentRating.SAFE, api: 'Safe' },
    { app: ContentRating.SUGGESTIVE, api: 'Suggestive' },
    { app: ContentRating.MATURE, api: 'Erotica' },
    { app: ContentRating.EXPLICIT, api: 'Pornographic' }
]

export type AtsumaruHomeSectionId =
    | 'popular'
    | 'hot-updates'
    | 'trending'
    | 'recently-updated'
    | 'recently-added'
    | 'top-rated'
    | 'most-bookmarked'

export interface AtsumaruHomeSection {
    id: AtsumaruHomeSectionId
    title: string
    style: SectionStyle
    endpoint?: string
    timeframe?: string
    searchSort?: string
    badge?: 'updated'
}

export interface AtsumaruListRequest {
    kind: 'browse' | 'search'
    url: string
}

export const ATSUMARU_HOME_SECTIONS: AtsumaruHomeSection[] = [
    {
        id: 'popular',
        title: 'Popular',
        style: SectionStyle.SimpleHeroPaged,
        endpoint: 'popular',
        timeframe: 'daily'
    },
    {
        id: 'hot-updates',
        title: 'Hot Updates',
        style: SectionStyle.SimpleSingleRow,
        endpoint: 'hotUpdates',
        badge: 'updated'
    },
    {
        id: 'trending',
        title: 'Trending',
        style: SectionStyle.SimpleSingleRow,
        searchSort: 'trending'
    },
    {
        id: 'recently-updated',
        title: 'Recently Updated',
        style: SectionStyle.SimpleDoubleRow,
        endpoint: 'recentlyUpdated',
        badge: 'updated'
    },
    {
        id: 'recently-added',
        title: 'Recently Added',
        style: SectionStyle.SimpleSingleRow,
        endpoint: 'recentlyAdded'
    },
    {
        id: 'top-rated',
        title: 'Top Rated',
        style: SectionStyle.SimpleSingleRow,
        endpoint: 'topRated'
    },
    {
        id: 'most-bookmarked',
        title: 'Most Bookmarked',
        style: SectionStyle.SimpleSingleRow,
        endpoint: 'mostBookmarked',
        timeframe: 'weekly'
    }
]

const SORT_FIELDS: Record<string, string> = {
    popularity: 'views',
    trending: 'trending',
    added: 'dateAdded',
    released: 'releaseDate',
    rating: 'mbRating',
    title: 'title'
}

function toOptions(values: Array<{ id: string, name: string }> | undefined): Option[] {
    return (values ?? []).map((value) => ({
        id: value.id,
        title: value.name
    }))
}

function quotedList(options: Option[] | undefined): string {
    return (options ?? [])
        .map((option) => `\`${option.id.replace(/`/g, '')}\``)
        .join(',')
}

function quotedValues(values: string[]): string {
    return values.map((value) => `\`${value.replace(/`/g, '')}\``).join(',')
}

export function allowedAtsumaruRatings(
    context: AtsumaruSourceContext | undefined
): AtsumaruContentRating[] {
    const values = context?.allowedContentRatings
    if (values === undefined) return ATSUMARU_RATINGS.map((rating) => rating.api)
    if (!Array.isArray(values)) return []

    const allowed = new Set(values)
    return ATSUMARU_RATINGS
        .filter((rating) => allowed.has(rating.app))
        .map((rating) => rating.api)
}

function addExcludableFilter(
    filters: string[],
    field: string,
    selection: AtsumaruFilterProps['genres']
): void {
    const included = selection?.included ?? []
    const excluded = selection?.excluded ?? []

    if (included.length > 0) {
        filters.push(
            included
                .map((option) => `${field}:=\`${option.id.replace(/`/g, '')}\``)
                .join(' && ')
        )
    }
    if (excluded.length > 0) {
        filters.push(`${field}:!=[${quotedList(excluded)}]`)
    }
}

export function createAtsumaruSearchForm(filters: AtsumaruFilterData): SearchForm {
    return {
        sections: [
            SearchListSection({
                children: [
                    SearchExcludableMultiPickerSheet({
                        id: 'genres',
                        title: 'Genres',
                        options: toOptions(filters.genres)
                    }),
                    SearchExcludableMultiPickerSheet({
                        id: 'tags',
                        title: 'Tags',
                        options: toOptions(filters.tags)
                    })
                ]
            }),
            SearchListSection({
                header: 'Publication',
                children: [
                    SearchMultiPicker({
                        id: 'types',
                        title: 'Type',
                        options: toOptions(filters.types)
                    }),
                    SearchMultiPicker({
                        id: 'statuses',
                        title: 'Status',
                        options: toOptions(filters.statuses)
                    }),
                    SearchStepper({
                        id: 'year',
                        title: 'Release year',
                        lowerBound: 1900,
                        upperBound: new Date().getFullYear() + 1,
                        step: 1
                    }),
                    SearchStepper({
                        id: 'minimumChapters',
                        title: 'Minimum chapters',
                        lowerBound: 0,
                        step: 1
                    }),
                    SearchToggle({
                        id: 'officialTranslation',
                        title: 'Official translations only'
                    })
                ]
            }),
            SearchSortSection({ header: 'Sort' })
        ]
    }
}

export function createAtsumaruSortOptions(): SortOption[] {
    return [
        { id: 'popularity', title: 'Popularity', isDefault: true, isOrderable: true },
        { id: 'trending', title: 'Trending', isOrderable: true },
        { id: 'added', title: 'Recently added', isOrderable: true },
        { id: 'released', title: 'Release date', isOrderable: true },
        { id: 'rating', title: 'Top rated', isOrderable: true },
        { id: 'title', title: 'Title', isOrderable: true }
    ]
}

export function buildAtsumaruSearchUrl(
    request: SearchRequest<AtsumaruFilterProps>,
    pageSize = ATSUMARU_PAGE_SIZE
): string {
    const query = request.query?.trim() ?? ''
    const filters = [
        'hidden:!=true',
        'medium:=[`Comic`]'
    ]
    const selected = request.filters
    const ratings = allowedAtsumaruRatings(request.context)

    if (ratings.length === 0) {
        filters.push('id:=`__mana_no_visible_rating__`')
    } else if (ratings.length < ATSUMARU_RATINGS.length) {
        filters.push(`mbContentRating:=[${quotedValues(ratings)}]`)
        if (!ratings.includes('Pornographic')) filters.push('isAdult:=false')
    }

    addExcludableFilter(filters, 'genreIds', selected?.genres)
    addExcludableFilter(filters, 'tagIds', selected?.tags)

    const types = quotedList(selected?.types)
    if (types) filters.push(`type:=[${types}]`)

    const statuses = quotedList(selected?.statuses)
    if (statuses) filters.push(`status:=[${statuses}]`)

    if ((selected?.year ?? 0) > 0) {
        filters.push(`releaseYear:=${selected?.year}`)
    }
    if ((selected?.minimumChapters ?? 0) > 0) {
        filters.push(`chapterCount:>=${selected?.minimumChapters}`)
    }
    if (selected?.officialTranslation) {
        filters.push('officialTranslation:=true')
    }

    const sortField = SORT_FIELDS[request.sort?.id ?? 'popularity'] ?? 'views'
    const sortDirection = request.sort?.ascending ? 'asc' : 'desc'
    return createAtsumaruUrl('/collections/manga/documents/search', {
        q: query || '*',
        filter_by: filters.join(' && '),
        sort_by: `${sortField}:${sortDirection}`,
        page: Math.max(1, request.page || 1),
        per_page: pageSize,
        query_by: query ? 'title,englishTitle,otherNames,authors' : undefined,
        query_by_weights: query ? '4,3,2,1' : undefined,
        num_typos: query ? '4,3,2,1' : undefined
    })
}

export function getAtsumaruHomeSection(
    sectionId: string
): AtsumaruHomeSection | undefined {
    return ATSUMARU_HOME_SECTIONS.find((section) => section.id === sectionId)
}

export function buildAtsumaruListRequest(
    sectionId: string,
    page: number,
    limit = ATSUMARU_PAGE_SIZE,
    context?: AtsumaruSourceContext
): AtsumaruListRequest {
    const section = getAtsumaruHomeSection(sectionId)
    if (!section) throw new Error(`Unknown Atsumaru list: ${sectionId}`)

    if (section.searchSort) {
        return {
            kind: 'search',
            url: buildAtsumaruSearchUrl({
                page,
                context,
                sort: { id: section.searchSort, ascending: false }
            }, limit)
        }
    }

    const ratings = allowedAtsumaruRatings(context)
    return {
        kind: 'browse',
        url: createAtsumaruUrl(`/api/home2/${section.endpoint}`, {
            offset: (Math.max(1, page) - 1) * limit,
            limit,
            types: 'Manga,Manwha,Manhua,OEL',
            mediums: 'Comic',
            adult: ratings.includes('Pornographic') ? 1 : undefined,
            contentRatings: ratings.length < ATSUMARU_RATINGS.length
                ? ratings.join(',')
                : undefined,
            timeframe: section.timeframe
        })
    }
}
