import {
    ExcludableMultiSelectProp,
    Option
} from '@mana-app/types'

export const MANGADOT_DOMAIN = 'https://mangadot.net'
export const MANGADOT_LANGUAGE = 'en_US'
export const MANGADOT_PAGE_SIZE = 28

export type MangaDotChapterMode = 'chapters' | 'volumes' | 'both'
export type MangaDotContentRating = 'safe' | 'suggestive' | 'erotica' | 'pornographic'
export type MangaDotOrigin = 'JP' | 'KR' | 'CN' | 'ONESHOT'
export type MangaDotReaderSource = 'user' | 'scraper'

export interface MangaDotBrowsePreferences {
    excludedTypes: MangaDotOrigin[]
    browseStatus: string
    excludedDemographics: string[]
    excludedGenres: string[]
    excludedAdultGenres: string[]
}

export interface MangaDotChapterPreferences {
    chapterMode: MangaDotChapterMode
    preferredScanlators: string
}

export interface MangaDotDetailsPreferences {
    showDetailedTags: boolean
}

export type MangaDotPreferences = MangaDotBrowsePreferences &
    MangaDotChapterPreferences & MangaDotDetailsPreferences

export type MangaDotFilterProps = {
    [key: `tagCategory_${string}`]: ExcludableMultiSelectProp
    genres?: ExcludableMultiSelectProp
    tags?: ExcludableMultiSelectProp
    visibility?: Option
    origins?: Option[]
    status?: Option
    longstrip?: boolean
    volumes?: Option
    scanlator?: Option
    author?: string
    artist?: string
    yearFrom?: number
    yearTo?: number
    minimumRating?: number
    minimumChapters?: number
}

export interface MangaDotFacetBucket {
    key: string
    count: number
}

export interface MangaDotFacets {
    genres?: MangaDotFacetBucket[]
    tags?: MangaDotFacetBucket[]
    content_rating?: MangaDotFacetBucket[]
    origin?: MangaDotFacetBucket[]
    status?: MangaDotFacetBucket[]
    year?: MangaDotFacetBucket[]
}

export interface MangaDotPagination {
    current_page?: number | null
    total_pages?: number | null
    total_results?: number | null
    total_manga?: number | null
    per_page?: number | null
    next_cursor?: string | null
}

export interface MangaDotTagItem {
    name: string
    is_adult?: boolean
}

export interface MangaDotTagCategory {
    category: string
    is_adult?: boolean
    tags?: MangaDotTagItem[]
}

export interface MangaDotManga {
    id: number
    title: string
    photo?: string | null
    banner_image?: string | null
    description?: string | null
    genres?: string[]
    tags?: MangaDotTagCategory[] | string | null
    status?: string | null
    hiatus?: string | null
    country_of_origin?: string | null
    content_rating?: MangaDotContentRating | string | null
    is_adult?: boolean | number | null
    is_blurworthy?: boolean | number | null
    is_longstrip?: boolean | null
    latest_chapter_number?: number | string | null
    chapter_count?: number | null
    avg_rating?: number | null
    alt_titles?: string[] | string | null
    authors?: string[] | string | null
    artists?: string[] | string | null
    source_url?: string | null
    anilist_id?: number | null
    mal_id?: number | null
    mangaupdates_id?: string | null
    mangadex_id?: string | null
    kitsu_id?: number | null
    mangabaka_id?: number | null
}

export interface MangaDotPagedResponse {
    manga_list?: MangaDotManga[]
    pagination?: MangaDotPagination
    facets?: MangaDotFacets
}

export interface MangaDotDetailsResponse {
    manga: MangaDotManga
}

export interface MangaDotSuggestionsResponse {
    suggestions?: MangaDotManga[]
}

export interface MangaDotRelationsResponse {
    relations?: Record<string, MangaDotManga[]> | []
}

export interface MangaDotTagsResponse {
    categories?: Array<{
        category: string
        tags?: Array<{
            name: string
            series_count?: number
            is_adult?: boolean
        }>
    }>
}

export interface MangaDotChapter {
    id: number
    chapter_number?: number | null
    volume_number?: number | null
    chapter_title?: string | null
    language?: string | null
    group_id?: number | null
    group_name?: string | null
    scanlator_name?: string | null
    date_added?: string | null
    source?: string | null
}

export interface MangaDotVolume {
    id: number
    volume_number?: number | null
    language?: string | null
    group_id?: number | null
    group_name?: string | null
    scanlator_name?: string | null
    date_added?: string | null
}

export interface MangaDotImagesResponse {
    images?: Array<{
        url?: string | null
    }>
}

export interface MangaDotChapterReference {
    source: MangaDotReaderSource
    id: string
}

export interface MangaDotSearchOptions {
    genres: Option[]
    tagCategories: Array<{
        id: `tagCategory_${string}`
        title: string
        options: Option[]
    }>
}
