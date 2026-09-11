import {
    Option,
    SearchExcludableMultiPickerSheet,
    SearchForm,
    SearchListSection,
    SearchMultiPicker,
    SearchMenuPicker,
    SearchRequest,
    SearchSortSection,
    SearchStepper,
    SearchTagsSection,
    SearchTextField,
    SortOption
} from '@mana-app/types'
import {
    ComixBrowseOption,
    ComixBrowseOptions,
    ComixFilterProps,
    ComixSearchLookups
} from './ComixInterfaces'
import {
    buildComixPreferenceParams,
    ComixPreferences,
    contentRatingsForPreference,
    DEFAULT_COMIX_PREFERENCES
} from './ComixPreferences'

export const COMIX_SEARCH_LIMIT = 28
const COMIX_TYPE_COUNT = 4
const COMIX_DEMOGRAPHIC_COUNT = 4
const COMIX_OLDEST_YEAR = 1928

const FALLBACK_SORTS: Array<[string, string]> = [
    ['relevance:desc', 'Best match'],
    ['chapter_updated_at:desc', 'Latest update'],
    ['created_at:desc', 'Recently added'],
    ['title:asc', 'Title (A–Z)'],
    ['title:desc', 'Title (Z–A)'],
    ['year:desc', 'Year (newest)'],
    ['year:asc', 'Year (oldest)'],
    ['score:desc', 'Highest rated'],
    ['views_7d:desc', 'Most viewed · 7 days'],
    ['views_30d:desc', 'Most viewed · 30 days'],
    ['views_90d:desc', 'Most viewed · 90 days'],
    ['views_total:desc', 'Most viewed · all time'],
    ['follows_total:desc', 'Most followed']
]

const CONTENT_RATING_OPTIONS: Option[] = [
    { id: 'source', title: 'Use source setting' },
    { id: 'all', title: 'Show all' },
    { id: 'safe', title: 'Safe only' },
    { id: 'suggestive', title: 'Up to Suggestive' },
    { id: 'erotica', title: 'Up to Erotica' },
    { id: 'pornographic', title: 'Up to Pornographic' }
]

const MATCH_MODE_OPTIONS: Option[] = [
    { id: 'and', title: 'All selected terms (AND)' },
    { id: 'or', title: 'Any selected term (OR)' }
]

function toOptions(options: ComixBrowseOption[] | undefined): Option[] {
    return (options ?? []).map((option) => ({
        id: `${option.id}`,
        title: option.label
    }))
}

function optionIds(options: Option[] | undefined): string[] {
    return (options ?? []).map((option) => option.id)
}

function addOptionIds(
    params: Record<string, unknown>,
    key: string,
    options: Option[] | undefined
): void {
    const ids = optionIds(options)
    if (ids.length > 0) {
        params[key] = ids
    }
}

function toOrder(sortId: string): Record<string, 'asc' | 'desc'> {
    const separatorIndex = sortId.lastIndexOf(':')
    const field = separatorIndex >= 0 ? sortId.slice(0, separatorIndex) : sortId
    const direction = separatorIndex >= 0 ? sortId.slice(separatorIndex + 1) : 'desc'

    return {
        [field || 'chapter_updated_at']: direction === 'asc' ? 'asc' : 'desc'
    }
}

export function createComixSearchForm(options: ComixBrowseOptions): SearchForm {
    const years = (options.years ?? [])
        .map(Number)
        .filter(Number.isFinite)
    const currentYear = new Date().getFullYear()
    const maximumYear = years.length > 0 ? Math.max(...years) : currentYear + 1

    return {
        sections: [
            SearchListSection({
                children: [SearchExcludableMultiPickerSheet({
                    id: 'genres',
                    title: 'Genres',
                    options: toOptions(options.genres)
                })]
            }),
            SearchListSection({
                children: [SearchExcludableMultiPickerSheet({
                    id: 'formats',
                    title: 'Formats',
                    options: toOptions(options.formats)
                })]
            }),
            SearchTagsSection({
                header: 'Type',
                field: SearchMultiPicker({
                    id: 'types',
                    title: 'Type',
                    options: toOptions(options.types)
                })
            }),
            SearchTagsSection({
                header: 'Demographic',
                field: SearchMultiPicker({
                    id: 'demographics',
                    title: 'Demographic',
                    options: toOptions(options.demographics)
                })
            }),
            SearchListSection({
                header: 'Content options',
                children: [
                    SearchMenuPicker({
                        id: 'contentRating',
                        title: 'Content rating',
                        options: CONTENT_RATING_OPTIONS
                    }),
                    SearchMenuPicker({
                        id: 'matchMode',
                        title: 'Match selected terms',
                        options: MATCH_MODE_OPTIONS
                    })
                ]
            }),
            SearchListSection({
                header: 'Publication',
                children: [
                    SearchMultiPicker({
                        id: 'statuses',
                        title: 'Release status',
                        options: toOptions(options.statuses)
                    }),
                    SearchStepper({
                        id: 'minimumChapters',
                        title: 'Minimum chapters',
                        lowerBound: 0,
                        step: 1
                    }),
                    SearchStepper({
                        id: 'yearFrom',
                        title: 'Release year from',
                        lowerBound: COMIX_OLDEST_YEAR,
                        upperBound: maximumYear,
                        step: 1
                    }),
                    SearchStepper({
                        id: 'yearTo',
                        title: 'Release year to',
                        lowerBound: COMIX_OLDEST_YEAR,
                        upperBound: maximumYear,
                        step: 1
                    })
                ]
            }),
            SearchListSection({
                header: 'Credits & tags',
                footer: 'Enter multiple names separated by commas.',
                children: [
                    SearchTextField({
                        id: 'tags',
                        title: 'Tags',
                        placeholder: 'Demons, Time Travel'
                    }),
                    SearchTextField({
                        id: 'author',
                        title: 'Author'
                    }),
                    SearchTextField({
                        id: 'artist',
                        title: 'Artist'
                    })
                ]
            }),
            SearchSortSection({ header: 'Sort' })
        ]
    }
}

export function createComixSortOptions(options: ComixBrowseOptions): SortOption[] {
    const sorts = options.sorts?.length ? options.sorts : FALLBACK_SORTS

    return sorts.map(([id, title]) => ({
        id,
        title,
        isDefault: id === 'chapter_updated_at:desc',
        isOrderable: false
    }))
}

export function buildComixSearchParams(
    request: SearchRequest<ComixFilterProps>,
    preferences: ComixPreferences = DEFAULT_COMIX_PREFERENCES
): Record<string, unknown> {
    const query = request.query?.trim() ?? ''
    const sortId = query
        ? 'relevance:desc'
        : request.sort?.id ?? 'chapter_updated_at:desc'
    const filters = request.filters
    const params: Record<string, unknown> = {
        ...buildComixPreferenceParams(preferences),
        page: Math.max(1, request.page || 1),
        limit: COMIX_SEARCH_LIMIT
    }

    if (query) {
        params.keyword = query
    }
    if (sortId.startsWith('relevance:')) {
        params.sort = sortId
    } else {
        params.order = toOrder(sortId)
    }

    const ratingId = filters?.contentRating?.id
    if (ratingId && ratingId !== 'source') {
        delete params.content_rating
        if (ratingId !== 'all') {
            const ratings = contentRatingsForPreference(
                ratingId as ComixPreferences['contentRating']
            )
            if (ratings?.length) params.content_rating = ratings
        }
    }

    const selectedTypes = optionIds(filters?.types)
    if (selectedTypes.length > 0) {
        if (selectedTypes.length >= COMIX_TYPE_COUNT) {
            delete params.types
        } else {
            params.types = selectedTypes
        }
    }
    addOptionIds(params, 'statuses', filters?.statuses)
    const selectedDemographics = optionIds(filters?.demographics)
    if (selectedDemographics.length > 0) {
        if (selectedDemographics.length >= COMIX_DEMOGRAPHIC_COUNT) {
            delete params.demographics
        } else {
            params.demographics = selectedDemographics
        }
    }

    const includedTerms = unique([
        ...optionIds(filters?.genres?.included),
        ...optionIds(filters?.formats?.included)
    ])
    const excludedTerms = unique([
        ...optionIds(filters?.genres?.excluded),
        ...optionIds(filters?.formats?.excluded),
        ...preferences.blockedGenres.filter((id) => !includedTerms.includes(id))
    ]).filter((id) => !includedTerms.includes(id))
    if (includedTerms.length > 0) {
        params.genres_in = includedTerms
    } else {
        delete params.genres_in
    }
    if (excludedTerms.length > 0) {
        params.genres_ex = excludedTerms
    } else {
        delete params.genres_ex
    }
    if (
        includedTerms.length > 0 ||
        excludedTerms.length > 0 ||
        Boolean(filters?.tags?.trim())
    ) {
        params.genres_mode = filters?.matchMode?.id === 'or' ? 'or' : 'and'
    } else {
        delete params.genres_mode
    }

    if ((filters?.yearFrom ?? 0) > 0) {
        params.year_from = filters?.yearFrom
    }
    if ((filters?.yearTo ?? 0) > 0) {
        params.year_to = filters?.yearTo
    }
    if ((filters?.minimumChapters ?? 0) > 0) {
        params.min_chap = filters?.minimumChapters
    }

    return params
}

function unique(values: string[]): string[] {
    return [...new Set(values)]
}

function splitNames(value: string | undefined): string[] | undefined {
    const names = unique(
        (value ?? '')
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean)
    )
    return names.length > 0 ? names : undefined
}

export function buildComixSearchLookups(
    filters: ComixFilterProps | undefined
): ComixSearchLookups {
    return {
        tags: splitNames(filters?.tags),
        authors: splitNames(filters?.author),
        artists: splitNames(filters?.artist)
    }
}

export function buildComixHomeSectionParams(
    listId: string,
    page: number,
    preferences: ComixPreferences = DEFAULT_COMIX_PREFERENCES
): Record<string, unknown> {
    const shared = {
        ...buildComixPreferenceParams(preferences),
        page: Math.max(1, page || 1),
        limit: COMIX_SEARCH_LIMIT
    }

    switch (listId) {
        case 'latest':
            return {
                ...shared,
                scope: 'hot',
                order: { chapter_updated_at: 'desc' }
            }
        case 'recently-added':
            return {
                ...shared,
                order: { created_at: 'desc' }
            }
        default:
            throw new Error(`Unknown Comix home section: ${listId}`)
    }
}
