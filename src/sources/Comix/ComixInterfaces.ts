import { ExcludableMultiSelectProp, Option } from '@mana-app/types'

export type ComixContentRating = 'safe' | 'suggestive' | 'erotica' | 'pornographic'
export type ComixMangaType = 'manga' | 'manhwa' | 'manhua' | 'other'
export type ComixPublicationStatus =
    | 'releasing'
    | 'finished'
    | 'on_hiatus'
    | 'discontinued'
    | 'not_yet_released'

export interface ComixPoster {
    small?: string
    medium?: string
    large?: string
}

export interface ComixProperty {
    id: number | string
    title: string
    slug?: string
}

export interface ComixExternalLinks {
    al?: string | null
    mal?: string | null
    mu?: string | null
    md?: string | null
    mb?: string | null
}

export interface ComixSourceLink {
    label: string
    url: string
}

export interface ComixManga {
    id?: number
    hid: string
    title: string
    altTitles?: string[]
    type?: ComixMangaType
    status?: ComixPublicationStatus
    originalLanguage?: string
    poster?: ComixPoster
    latestChapter?: number
    finalChapter?: number
    finalVolume?: number
    hasChapters?: boolean
    chapterUpdatedAtFormatted?: string
    createdAtFormatted?: string
    updatedAtFormatted?: string
    startDate?: string
    endDate?: string
    year?: number
    rank?: number
    synopsis?: string
    synopsisHtml?: string
    followsTotal?: number
    ratedAvg?: number
    ratedCount?: number
    contentRating?: ComixContentRating
    links?: ComixExternalLinks
    url?: string
    uploadUrl?: string
    editUrl?: string
    genres?: ComixProperty[]
    demographics?: ComixProperty[]
    formats?: ComixProperty[]
    tags?: ComixProperty[]
    authors?: ComixProperty[]
    artists?: ComixProperty[]
    publishers?: ComixProperty[]
    sources?: ComixSourceLink[]
}

export interface ComixChapterGroup {
    id: number | string
    name: string
    slug?: string | null
}

export interface ComixChapter {
    id: number | string
    number: number | string
    volume?: number | null
    name?: string | null
    url?: string
    createdAt?: string
    created_at?: string
    createdAtFormatted?: string
    group?: ComixChapterGroup | null
    isOfficial?: boolean
    votes?: number
}

export interface ComixResolvedPage {
    url?: string
    raw?: string
}

export interface ComixPagedMeta {
    total?: number
    perPage?: number
    page?: number
    lastPage?: number
    from?: number
    to?: number
    hasNext?: boolean
    hasPrev?: boolean
    pagesFetched?: number
}

export interface ComixPagedResponse<T> {
    items: T[]
    meta?: ComixPagedMeta
}

export interface ComixBrowseOption {
    id: number | string
    label: string
    slug?: string
}

export interface ComixBrowseOptions {
    genres?: ComixBrowseOption[]
    demographics?: ComixBrowseOption[]
    formats?: ComixBrowseOption[]
    statuses?: ComixBrowseOption[]
    types?: ComixBrowseOption[]
    years?: string[]
    sorts?: Array<[string, string]>
}

export interface ComixHomeData {
    trending: ComixManga[]
    mostFollowed: ComixManga[]
    latest: ComixPagedResponse<ComixManga>
    recentlyAdded: ComixPagedResponse<ComixManga>
}

export type ComixFilterProps = {
    contentRating?: Option
    types?: Option[]
    statuses?: Option[]
    genres?: ExcludableMultiSelectProp
    formats?: ExcludableMultiSelectProp
    demographics?: Option[]
    tags?: string
    author?: string
    artist?: string
    matchMode?: Option
    yearFrom?: number
    yearTo?: number
    minimumChapters?: number
}

export interface ComixSearchLookups {
    tags?: string[]
    authors?: string[]
    artists?: string[]
}

export type ComixWebViewOperation =
    | 'chapter'
    | 'chapters'
    | 'home'
    | 'list'

export interface ComixWebViewPayload {
    mangaId?: string
    chapterId?: string
    params?: Record<string, unknown>
    lookups?: ComixSearchLookups
}
