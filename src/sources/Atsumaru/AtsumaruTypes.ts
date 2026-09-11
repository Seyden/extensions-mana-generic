import {
    ExcludableMultiSelectProp,
    Option
} from '@mana-app/types'

export type AtsumaruContentRating =
    | 'Safe'
    | 'Suggestive'
    | 'Erotica'
    | 'Pornographic'

export interface AtsumaruImageSet {
    id?: string
    image?: string
    smallImage?: string
    mediumImage?: string
    largeImage?: string
}

export type AtsumaruImage = string | AtsumaruImageSet | null

export interface AtsumaruPerson {
    id?: string
    name: string
    type?: string
}

export interface AtsumaruTaxonomyItem {
    id: string
    name: string
    namePath?: string
    weight?: string
}

export interface AtsumaruRelation {
    type?: string
    manga: AtsumaruManga
}

export interface AtsumaruScanlator {
    id: string
    name: string
}

export interface AtsumaruManga {
    id: string
    title: string
    englishTitle?: string | null
    image?: AtsumaruImage
    poster?: AtsumaruImage
    smallImage?: string | null
    mediumImage?: string | null
    largeImage?: string | null
    isAdult?: boolean
    mbContentRating?: AtsumaruContentRating | string | null
    type?: string | null
    medium?: string | null
    status?: string | null
    synopsis?: string | null
    otherNames?: string[] | null
    authors?: Array<string | AtsumaruPerson> | null
    genres?: Array<string | AtsumaruTaxonomyItem> | null
    tags?: Array<string | AtsumaruTaxonomyItem> | null
    released?: number | string | null
    releaseYear?: number | null
    year?: number | null
    createdAt?: number | string | null
    updatedAt?: number | string | null
    views?: number | string | null
    avgRating?: number | null
    mbRating?: number | null
    scanlators?: AtsumaruScanlator[] | null
    recommendations?: AtsumaruManga[] | null
    similarManga?: AtsumaruManga[] | null
    relations?: AtsumaruRelation[] | null
    anilistId?: number | string | null
    malId?: number | string | null
    kitsuId?: number | string | null
    mangaUpdatesId?: number | string | null
    annId?: number | string | null
    kenmeiUrl?: string | null
}

export interface AtsumaruChapter {
    id: string
    number: number | string
    title?: string | null
    createdAt?: number | string | null
    index?: number | null
    pageCount?: number | null
    scanlationMangaId?: string | null
}

export interface AtsumaruPage {
    image?: string | null
}

export interface AtsumaruBrowseResponse {
    items: AtsumaruManga[]
}

export interface AtsumaruSearchHit {
    document: AtsumaruManga
}

export interface AtsumaruSearchResponse {
    page: number
    found: number
    hits: AtsumaruSearchHit[]
    request_params?: {
        per_page?: number
    }
}

export interface AtsumaruMangaResponse {
    mangaPage: AtsumaruManga
}

export interface AtsumaruChaptersResponse {
    chapters: AtsumaruChapter[]
}

export interface AtsumaruChapterResponse {
    readChapter: {
        pages: AtsumaruPage[]
    }
}

export interface AtsumaruFilterOption {
    id: string
    name: string
}

export interface AtsumaruFilterData {
    genres?: AtsumaruFilterOption[]
    tags?: AtsumaruFilterOption[]
    types?: AtsumaruFilterOption[]
    statuses?: AtsumaruFilterOption[]
}

export type AtsumaruFilterProps = {
    genres?: ExcludableMultiSelectProp
    tags?: ExcludableMultiSelectProp
    types?: Option[]
    statuses?: Option[]
    year?: number
    minimumChapters?: number
    officialTranslation?: boolean
}
