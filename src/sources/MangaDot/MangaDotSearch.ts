import {
    ContentRating,
    ExcludableMultiSelectProp,
    Form,
    Option,
    PagedSearchResult,
    SearchExcludableMultiPickerSheet,
    SearchForm,
    SearchGroup,
    SearchListSection,
    SearchMenuPicker,
    SearchMultiPicker,
    SearchRequest,
    SearchSortSection,
    SearchStepper,
    SearchTextField,
    SearchToggle,
    SectionStyle,
    SortOption,
    SourceContext,
    UIListSection,
    UIMultiPicker,
    UIPicker,
    UITagsSection,
    UITextField,
    UIToggle
} from '@mana-app/types'
import {
    MANGADOT_DOMAIN,
    MANGADOT_PAGE_SIZE,
    MangaDotBrowsePreferences,
    MangaDotChapterPreferences,
    MangaDotFacets,
    MangaDotFilterProps,
    MangaDotContentRating,
    MangaDotDetailsPreferences,
    MangaDotOrigin,
    MangaDotPreferences,
    MangaDotSearchOptions,
    MangaDotTagsResponse
} from './MangaDotTypes'

const KEYS = {
    chapterMode: 'MangaDot.chapterMode',
    preferredScanlators: 'MangaDot.preferredScanlators',
    excludedTypes: 'MangaDot.excludedTypes',
    browseStatus: 'MangaDot.browseStatus',
    excludedDemographics: 'MangaDot.excludedDemographics',
    excludedGenres: 'MangaDot.excludedGenres',
    excludedAdultGenres: 'MangaDot.excludedAdultGenres',
    showDetailedTags: 'MangaDot.showDetailedTags'
}

export const ALL_ORIGINS: MangaDotOrigin[] = ['JP', 'KR', 'CN', 'ONESHOT']
export const DEMOGRAPHICS = ['Josei', 'Seinen', 'Shoujo', 'Shounen']
const TAG_CATEGORY_PREFIX = 'tagCategory_'
let browsePreferencesCache: MangaDotBrowsePreferences | undefined
let chapterPreferencesCache: MangaDotChapterPreferences | undefined
let detailsPreferencesCache: MangaDotDetailsPreferences | undefined

type PreferenceScope = 'browse' | 'chapter' | 'details'

function invalidatePreferenceCache(scope: PreferenceScope): void {
    if (scope === 'browse') browsePreferencesCache = undefined
    if (scope === 'chapter') chapterPreferencesCache = undefined
    if (scope === 'details') detailsPreferencesCache = undefined
}

async function storePreference(
    key: string,
    value: unknown,
    scope: PreferenceScope
): Promise<void> {
    await ObjectStore.set(key, value)
    invalidatePreferenceCache(scope)
}

export function resetMangaDotPreferenceCaches(): void {
    browsePreferencesCache = undefined
    chapterPreferencesCache = undefined
    detailsPreferencesCache = undefined
}

const MANGADOT_RATINGS: ReadonlyArray<{
    app: ContentRating
    api: MangaDotContentRating
}> = [
    { app: ContentRating.SAFE, api: 'safe' },
    { app: ContentRating.SUGGESTIVE, api: 'suggestive' },
    { app: ContentRating.MATURE, api: 'erotica' },
    { app: ContentRating.EXPLICIT, api: 'pornographic' }
]

export const HOME_SECTIONS = [
    { id: 'top-rated', title: 'Top Rated', sort: 'rating', style: SectionStyle.SimpleHeroPaged },
    { id: 'latest-updates', title: 'Latest Updates', sort: 'latest', style: SectionStyle.SimpleSingleRow },
    { id: 'recently-added', title: 'Recently Added', sort: 'latest', style: SectionStyle.SimpleSingleRow },
    { id: 'most-tracked', title: 'Most Tracked', sort: 'tracked', style: SectionStyle.SimpleSingleRow }
] as const

export const DEFAULT_MANGADOT_BROWSE_PREFERENCES: MangaDotBrowsePreferences = {
    excludedTypes: [],
    browseStatus: '',
    excludedDemographics: [],
    excludedGenres: [],
    excludedAdultGenres: []
}

export const DEFAULT_MANGADOT_CHAPTER_PREFERENCES: MangaDotChapterPreferences = {
    chapterMode: 'both',
    preferredScanlators: 'VIZ Media, MANGA Plus, MangaPlus, Official, Webtoon, Tapas, MangaDex, K Manga, Manga UP, Comikey, Shonen Jump'
}

export const DEFAULT_MANGADOT_DETAILS_PREFERENCES: MangaDotDetailsPreferences = {
    showDetailedTags: true
}

export const DEFAULT_MANGADOT_PREFERENCES: MangaDotPreferences = {
    ...DEFAULT_MANGADOT_BROWSE_PREFERENCES,
    ...DEFAULT_MANGADOT_CHAPTER_PREFERENCES,
    ...DEFAULT_MANGADOT_DETAILS_PREFERENCES
}

const ORIGIN_OPTIONS: Option[] = [
    { id: 'JP', title: 'Manga' },
    { id: 'KR', title: 'Manhwa' },
    { id: 'CN', title: 'Manhua' },
    { id: 'ONESHOT', title: 'One Shot' }
]

const STATUS_OPTIONS: Option[] = [
    { id: '', title: 'Any' },
    { id: 'Ongoing', title: 'Ongoing' },
    { id: 'Completed', title: 'Completed' },
    { id: 'Hiatus', title: 'Hiatus' }
]

function uniqueOptions(values: string[]): Option[] {
    const seen = new Set<string>()
    return values
        .map((value) => value.trim())
        .filter((value) => {
            if (!value) return false
            const key = value.toLocaleLowerCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        .sort((left, right) => left.localeCompare(right))
        .map((value) => ({ id: value, title: value }))
}

function optionIds(options: Option[] | undefined): string[] {
    return (options ?? []).map((option) => option.id).filter(Boolean)
}

function normalizeKey(value: string): string {
    return value.trim().toLocaleLowerCase()
}

export function allowedMangaDotRatings(
    context: SourceContext | undefined
): ContentRating[] {
    const values = context?.allowedContentRatings
    if (values === undefined) return MANGADOT_RATINGS.map((rating) => rating.app)
    if (!Array.isArray(values)) return []

    const allowed = new Set(values)
    return MANGADOT_RATINGS
        .map((rating) => rating.app)
        .filter((rating) => allowed.has(rating))
}

function excludedApiRatings(context: SourceContext | undefined): MangaDotContentRating[] {
    if (context?.allowedContentRatings === undefined) return []

    const allowed = new Set(allowedMangaDotRatings(context))
    return MANGADOT_RATINGS
        .filter(({ app, api }) => {
            if (api === 'safe') {
                return !allowed.has(ContentRating.SAFE) && !allowed.has(ContentRating.MATURE)
            }
            if (api === 'suggestive') {
                return !allowed.has(ContentRating.SUGGESTIVE) && !allowed.has(ContentRating.MATURE)
            }
            return !allowed.has(app)
        })
        .map((rating) => rating.api)
}

export function filterMangaDotPageByContext(
    page: PagedSearchResult,
    context: SourceContext | undefined
): PagedSearchResult {
    if (context?.allowedContentRatings === undefined) return page

    const allowed = new Set(allowedMangaDotRatings(context))
    if (allowed.size === MANGADOT_RATINGS.length) return page

    return {
        ...page,
        results: page.results.filter((result) =>
            result.contentRating != null && allowed.has(result.contentRating)
        ),
        totalResultCount: undefined
    }
}

async function storedStringArray(key: string): Promise<string[]> {
    return await ObjectStore.stringArray(key) ?? []
}

export async function loadMangaDotBrowsePreferences(): Promise<MangaDotBrowsePreferences> {
    if (browsePreferencesCache) return browsePreferencesCache

    const [
        excludedTypes,
        browseStatus,
        excludedDemographics,
        excludedGenres,
        excludedAdultGenres
    ] = await Promise.all([
        storedStringArray(KEYS.excludedTypes),
        ObjectStore.string(KEYS.browseStatus),
        storedStringArray(KEYS.excludedDemographics),
        storedStringArray(KEYS.excludedGenres),
        storedStringArray(KEYS.excludedAdultGenres)
    ])

    browsePreferencesCache = {
        excludedTypes: excludedTypes.filter((value): value is MangaDotOrigin =>
            ALL_ORIGINS.includes(value as MangaDotOrigin)
        ),
        browseStatus: browseStatus ?? DEFAULT_MANGADOT_BROWSE_PREFERENCES.browseStatus,
        excludedDemographics,
        excludedGenres,
        excludedAdultGenres
    }
    return browsePreferencesCache
}

export async function loadMangaDotChapterPreferences(): Promise<MangaDotChapterPreferences> {
    if (chapterPreferencesCache) return chapterPreferencesCache

    const [chapterMode, preferredScanlators] = await Promise.all([
        ObjectStore.string(KEYS.chapterMode),
        ObjectStore.string(KEYS.preferredScanlators)
    ])
    const validMode = chapterMode === 'chapters' || chapterMode === 'volumes' || chapterMode === 'both'
        ? chapterMode
        : DEFAULT_MANGADOT_CHAPTER_PREFERENCES.chapterMode

    chapterPreferencesCache = {
        chapterMode: validMode,
        preferredScanlators: preferredScanlators ?? DEFAULT_MANGADOT_CHAPTER_PREFERENCES.preferredScanlators
    }
    return chapterPreferencesCache
}

export async function loadMangaDotDetailsPreferences(): Promise<MangaDotDetailsPreferences> {
    if (detailsPreferencesCache) return detailsPreferencesCache

    detailsPreferencesCache = {
        showDetailedTags: await ObjectStore.boolean(KEYS.showDetailedTags) ??
            DEFAULT_MANGADOT_DETAILS_PREFERENCES.showDetailedTags
    }
    return detailsPreferencesCache
}

export async function loadMangaDotPreferences(): Promise<MangaDotPreferences> {
    const [browse, chapter, details] = await Promise.all([
        loadMangaDotBrowsePreferences(),
        loadMangaDotChapterPreferences(),
        loadMangaDotDetailsPreferences()
    ])
    return { ...browse, ...chapter, ...details }
}

export function searchOptions(facets: MangaDotFacets, tags?: MangaDotTagsResponse): MangaDotSearchOptions {
    const genres = uniqueOptions((facets.genres ?? []).map((bucket) => bucket.key))
    const seenTags = new Set<string>()
    const usedIds = new Set<string>()
    const tagCategories = (tags?.categories ?? []).flatMap((category, index) => {
        const names = (category.tags ?? []).map((tag) => tag.name).filter((name) => {
            const key = normalizeKey(name)
            if (!key || seenTags.has(key)) return false
            seenTags.add(key)
            return true
        })
        const options = uniqueOptions(names)
        if (!category.category.trim() || options.length === 0) return []

        const baseId = category.category
            .normalize('NFKD')
            .toLocaleLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '') || String(index)
        let id = `${TAG_CATEGORY_PREFIX}${baseId}` as `tagCategory_${string}`
        let suffix = 2
        while (usedIds.has(id)) {
            id = `${TAG_CATEGORY_PREFIX}${baseId}_${suffix}` as `tagCategory_${string}`
            suffix += 1
        }
        usedIds.add(id)

        return [{ id, title: category.category.trim(), options }]
    })

    return {
        genres,
        tagCategories
    }
}

export function createMangaDotSearchForm(options: MangaDotSearchOptions): SearchForm {
    const tagGroup = options.tagCategories.length > 0
        ? SearchGroup({
            id: 'tags',
            title: 'Tags',
            children: options.tagCategories.map((category) =>
                SearchExcludableMultiPickerSheet({
                    id: category.id,
                    title: category.title,
                    options: category.options
                })
            )
        })
        : undefined
    const sections: SearchForm['sections'] = [
        SearchListSection({
            children: [
                SearchExcludableMultiPickerSheet({
                    id: 'genres',
                    title: 'Genres',
                    options: options.genres
                }),
                ...(tagGroup ? [tagGroup] : [])
            ]
        })
    ]

    sections.push(
        SearchListSection({
            header: 'Catalogue',
            children: [
                SearchMenuPicker({
                    id: 'visibility',
                    title: 'Adult content',
                    options: [
                        { id: 'mixed', title: 'All titles' },
                        { id: 'normal', title: 'Non-adult only' },
                        { id: 'adult', title: 'Adult only' }
                    ]
                }),
                SearchMultiPicker({
                    id: 'origins',
                    title: 'Type',
                    options: ORIGIN_OPTIONS
                }),
                SearchMenuPicker({
                    id: 'status',
                    title: 'Status',
                    options: STATUS_OPTIONS
                }),
                SearchToggle({ id: 'longstrip', title: 'Long-strip format' }),
                SearchMenuPicker({
                    id: 'volumes',
                    title: 'Volumes',
                    options: [
                        { id: '', title: 'Any' },
                        { id: 'with', title: 'Has volumes' },
                        { id: 'without', title: 'No volumes' }
                    ]
                }),
                SearchMenuPicker({
                    id: 'scanlator',
                    title: 'Scanlator group',
                    options: [
                        { id: '', title: 'Any' },
                        { id: 'with', title: 'Has scanlator group' },
                        { id: 'without', title: 'No scanlator group' }
                    ]
                })
            ]
        }),
        SearchListSection({
            header: 'Publication',
            children: [
                SearchStepper({ id: 'yearFrom', title: 'Year from', lowerBound: 1900, upperBound: 2100, step: 1 }),
                SearchStepper({ id: 'yearTo', title: 'Year to', lowerBound: 1900, upperBound: 2100, step: 1 }),
                SearchStepper({ id: 'minimumRating', title: 'Minimum rating', lowerBound: 0, upperBound: 10, step: 0.1, allowDecimal: true }),
                SearchStepper({ id: 'minimumChapters', title: 'Minimum chapters', lowerBound: 0, upperBound: 100_000, step: 1 })
            ]
        }),
        SearchListSection({
            header: 'Credits',
            children: [
                SearchTextField({ id: 'author', title: 'Author' }),
                SearchTextField({ id: 'artist', title: 'Artist' })
            ]
        }),
        SearchSortSection({ header: 'Sort' })
    )

    return { sections }
}

export function createMangaDotSortOptions(): SortOption[] {
    return [
        { id: 'relevance', title: 'Relevance', isDefault: false, isOrderable: false },
        { id: 'latest', title: 'Latest', isDefault: true, isOrderable: true },
        { id: 'alphabetical', title: 'Alphabetical', isDefault: false, isOrderable: true },
        { id: 'chapters', title: 'Chapter count', isDefault: false, isOrderable: true },
        { id: 'views', title: 'Most viewed', isDefault: false, isOrderable: true },
        { id: 'tracked', title: 'Most tracked', isDefault: false, isOrderable: true },
        { id: 'rating', title: 'Top rated', isDefault: false, isOrderable: true }
    ]
}

export function hasBrowsePreferences(preferences: MangaDotBrowsePreferences): boolean {
    return preferences.excludedTypes.length > 0 ||
        Boolean(preferences.browseStatus) ||
        preferences.excludedDemographics.length > 0 ||
        preferences.excludedAdultGenres.length > 0
}

export interface MangaDotSearchTarget {
    url?: string
    impossible: boolean
}

export function buildMangaDotSearchTarget(
    request: SearchRequest<MangaDotFilterProps>,
    preferences: MangaDotBrowsePreferences,
    sectionId?: string
): MangaDotSearchTarget {
    const allowedRatings = allowedMangaDotRatings(request.context)
    if (allowedRatings.length === 0) return { impossible: true }

    const filters = request.filters
    if (filters?.visibility?.id === 'adult' &&
        !allowedRatings.includes(ContentRating.MATURE) &&
        !allowedRatings.includes(ContentRating.EXPLICIT)) {
        return { impossible: true }
    }
    const includedGenres = optionIds(filters?.genres?.included)
    const includedKeys = new Set(includedGenres.map(normalizeKey))
    const savedGenres = filters?.visibility?.id === 'normal'
        ? preferences.excludedGenres
        : preferences.excludedAdultGenres
    const excludedGenres = [
        ...optionIds(filters?.genres?.excluded),
        ...savedGenres,
        ...preferences.excludedDemographics
    ].filter((genre) => !includedKeys.has(normalizeKey(genre)))

    const explicitOrigins = optionIds(filters?.origins)
    const origins = explicitOrigins.length > 0
        ? explicitOrigins
        : ALL_ORIGINS.filter((origin) => !preferences.excludedTypes.includes(origin))
    if (origins.length === 0) return { impossible: true }

    const section = HOME_SECTIONS.find((item) => item.id === sectionId)
    const query = request.query?.trim() ?? ''
    const selectedSort = request.sort?.id
    const sortBy = selectedSort ?? section?.sort ?? (query ? 'relevance' : 'latest')
    const ascending = request.sort?.ascending ?? sortBy === 'alphabetical'
    const params = new URLSearchParams({
        page: String(Math.max(1, request.page || 1)),
        limit: String(MANGADOT_PAGE_SIZE),
        sortBy,
        sortOrder: ascending ? 'asc' : 'desc'
    })

    if (query) params.set('search', query)
    if (origins.length < ALL_ORIGINS.length || explicitOrigins.length > 0) {
        params.set('origin', origins.join(','))
    }

    const status = filters?.status ? filters.status.id : preferences.browseStatus
    if (status) params.set('status', status)

    const genres = [
        ...includedGenres,
        ...[...new Set(excludedGenres)].map((genre) => `-${genre}`)
    ]
    if (genres.length > 0) params.set('genres', genres.join(','))

    const tagFields = [
        filters?.tags,
        ...Object.entries(filters ?? {})
            .filter(([key]) => key.startsWith(TAG_CATEGORY_PREFIX))
            .map(([, value]) => value as ExcludableMultiSelectProp | undefined)
    ].filter((field): field is ExcludableMultiSelectProp => field != null)
    const includedTags = uniqueOptions(tagFields.flatMap((field) =>
        optionIds(field.included)
    )).map((option) => option.id)
    const includedTagKeys = new Set(includedTags.map(normalizeKey))
    const excludedTags = uniqueOptions(tagFields.flatMap((field) =>
        optionIds(field.excluded)
    )).map((option) => option.id).filter((tag) => !includedTagKeys.has(normalizeKey(tag)))
    const tags = [
        ...includedTags,
        ...excludedTags.map((tag) => `-${tag}`)
    ]
    if (tags.length > 0) params.set('tags', tags.join(','))

    const excludedRatings = excludedApiRatings(request.context).map((rating) => `-${rating}`)
    if (excludedRatings.length > 0) params.set('content_rating', excludedRatings.join(','))

    if (filters?.visibility?.id === 'normal') params.set('strict_adult', '0')
    if (filters?.visibility?.id === 'adult') params.set('strict_adult', '1')
    if (filters?.longstrip) params.set('format', 'longstrip')
    if (filters?.volumes?.id) params.set('has_volumes', filters.volumes.id === 'with' ? '1' : '0')
    if (filters?.scanlator?.id) params.set('has_scanlator', filters.scanlator.id === 'with' ? '1' : '0')
    if (filters?.author?.trim()) params.set('author', filters.author.trim())
    if (filters?.artist?.trim()) params.set('artist', filters.artist.trim())
    if ((filters?.yearFrom ?? 0) > 0) params.set('year_min', String(filters?.yearFrom))
    if ((filters?.yearTo ?? 0) > 0) params.set('year_max', String(filters?.yearTo))
    if ((filters?.minimumRating ?? 0) > 0) params.set('min_rating', String(filters?.minimumRating))
    if ((filters?.minimumChapters ?? 0) > 0) params.set('min_chapters', String(filters?.minimumChapters))

    return { url: `${MANGADOT_DOMAIN}/api/search?${params.toString()}`, impossible: false }
}

export function createMangaDotPreferenceMenu(
    availableGenres: string[],
    preferences: MangaDotPreferences
): Form {
    const genres = uniqueOptions([
        ...availableGenres,
        ...preferences.excludedGenres,
        ...preferences.excludedAdultGenres
    ])
    return {
        sections: [
            UIListSection({
                header: 'Chapter list',
                children: [
                    UIPicker({
                        id: 'chapterMode',
                        title: 'Chapter list mode',
                        value: preferences.chapterMode,
                        options: [
                            { id: 'chapters', title: 'Chapters only' },
                            { id: 'volumes', title: 'Volumes only' },
                            { id: 'both', title: 'Chapters and volumes' }
                        ],
                        async didChange(value) { return storePreference(KEYS.chapterMode, value, 'chapter') }
                    })
                ]
            }),
            UIListSection({
                header: 'Scanlators',
                footer: 'Preferred scanlators are ordered first for the same chapter number. No releases are removed.',
                children: [
                    UITextField({
                        id: 'preferredScanlators',
                        title: 'Scanlator priority',
                        placeholder: 'VIZ Media, MANGA Plus, Webtoon',
                        value: preferences.preferredScanlators,
                        optional: true,
                        async didChange(value) { return storePreference(KEYS.preferredScanlators, value, 'chapter') }
                    })
                ]
            }),
            UIListSection({
                header: 'Browse filters',
                footer: 'Used on Home and as search defaults until an explicit search filter overrides them.',
                children: [
                    UIMultiPicker({
                        id: 'excludedTypes',
                        title: 'Type blacklist',
                        value: preferences.excludedTypes,
                        options: ORIGIN_OPTIONS,
                        optional: true,
                        async didChange(value) { return storePreference(KEYS.excludedTypes, value, 'browse') }
                    }),
                    UIPicker({
                        id: 'browseStatus',
                        title: 'Status filter',
                        value: preferences.browseStatus,
                        options: STATUS_OPTIONS,
                        async didChange(value) { return storePreference(KEYS.browseStatus, value, 'browse') }
                    }),
                    UIMultiPicker({
                        id: 'excludedDemographics',
                        title: 'Demographic blacklist',
                        value: preferences.excludedDemographics,
                        options: DEMOGRAPHICS.map((value) => ({ id: value, title: value })),
                        optional: true,
                        async didChange(value) { return storePreference(KEYS.excludedDemographics, value, 'browse') }
                    })
                ]
            }),
            UIListSection({
                header: 'Title details',
                children: [
                    UIToggle({
                        id: 'showDetailedTags',
                        title: 'Show tags in details',
                        value: preferences.showDetailedTags,
                        async didChange(value) { return storePreference(KEYS.showDetailedTags, value, 'details') }
                    })
                ]
            }),
            UITagsSection({
                header: 'Genre blacklist (non-adult)',
                footer: 'Used when a search explicitly selects Non-adult only.',
                field: UIMultiPicker({
                    id: 'excludedGenres',
                    title: 'Genres',
                    value: preferences.excludedGenres,
                    options: genres,
                    optional: true,
                    async didChange(value) { return storePreference(KEYS.excludedGenres, value, 'browse') }
                })
            }),
            UITagsSection({
                header: 'Genre blacklist (mixed/adult)',
                footer: 'Used on Home and for Mixed or Adult-only searches.',
                field: UIMultiPicker({
                    id: 'excludedAdultGenres',
                    title: 'Genres',
                    value: preferences.excludedAdultGenres,
                    options: genres,
                    optional: true,
                    async didChange(value) { return storePreference(KEYS.excludedAdultGenres, value, 'browse') }
                })
            })
        ]
    }
}
