import {
    ExcludableMultiSelectProp,
    Option,
    SectionStyle
} from '@mana-app/types'

export type IkenFilterProps = {
    genres?: ExcludableMultiSelectProp
    status?: Option
    types?: Option[]
    minimumChapters?: number
    maximumChapters?: number
    createdAfter?: string
    createdBefore?: string
}

export type IkenQueryValue = string | number | undefined

export type IkenHomeSectionId = 'popular_today' | 'latest_releases'

export interface IkenHomeSection {
    id: IkenHomeSectionId
    title: string
    orderBy: string
    style: SectionStyle
    containsMoreItems: boolean
}

export interface IkenGenre {
    id: number
    name: string
}

export interface IkenChapter {
    id: number
    number: number | string
    title?: string | null
    createdAt?: string | null
    isAccessible?: boolean | null
    isLocked?: boolean | null
    isTimeLocked?: boolean | null
    isPermanentlyLocked?: boolean | null
    isShortLinkLocked?: boolean | null
    price?: number | null
    chapterPurchased?: boolean | null
}

export interface IkenPost {
    id: number
    postTitle: string
    postContent?: string | null
    isNovel?: boolean | null
    featuredImage?: string | null
    alternativeTitles?: string | null
    author?: string | null
    artist?: string | null
    seriesType?: string | null
    seriesStatus?: string | null
    genres?: IkenGenre[] | null
    chapters?: IkenChapter[] | null
}

export interface IkenSearchResponse {
    posts: IkenPost[]
    totalCount: number
}

export interface IkenPostResponse {
    post: IkenPost
    totalChapterCount?: number
}

export interface IkenChaptersResponse {
    post: {
        chapters: IkenChapter[]
    }
    totalChapterCount?: number
}

export interface IkenPageImage {
    url: string
    order?: number | null
}

export interface IkenChapterData {
    images?: IkenPageImage[] | null
    isAccessible?: boolean | null
    isLocked?: boolean | null
    isLockedByCoins?: boolean | null
    isPermanentlyLocked?: boolean | null
    isShortLinkLocked?: boolean | null
}

export interface IkenChapterResponse {
    chapter: IkenChapterData
}
