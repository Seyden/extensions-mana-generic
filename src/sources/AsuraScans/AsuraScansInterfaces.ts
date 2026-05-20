import { Option } from "@mana-app/types";

export interface StatusTypes {
    ONGOING: string;
    HIATUS: string;
    COMPLETED: string;
    DROPPED: string;
    SEASONEND: string;
    COMINGSOON: string;
}

export type FilterProps = {
    status?: Option; // select
    type?: Option; // select
    chapters?: Option; // select

    genres?: Option[];
};

export const statusOptions = [
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'completed', label: 'Completed' },
    { value: 'hiatus', label: 'Hiatus' },
    { value: 'dropped', label: 'Dropped' }
]

export const typeOptions = [
    { value: 'manhwa', label: 'Manhwa' },
    { value: 'manhua', label: 'Manhua' },
    { value: 'manga', label: 'Mangatoon' }
]

export const orderOptions = [
    { value: 'latest', label: 'Latest Update' },
    { value: 'popular', label: 'Popular' },
    { value: 'rating', label: 'Rating' },
    { value: 'title', label: 'A-Z' },
    { value: 'newest', label: 'Newest' }
]

export interface SeriesDetail {
    slug: string
    title: string
    alt_titles?: string[]
    alternative_titles?: string
    description: string
    cover: string
    status: string
    author?: string
    artist?: string
    rating: number
    genres: { id: number; name: string; slug: string }[]
}

export interface SeriesChapter {
    id: number
    number: number
    title?: string
    published_at: string
    is_locked?: boolean
    is_premium?: boolean
}

export interface Genre {
    id: number
    name: string
    slug: string
}

export interface GenresResponse {
    data: Genre[]
}

export interface ApiChapterPage {
    url: string
    order?: number
}

export interface ChapterDetail {
    pages?: ApiChapterPage[]
}

export interface ChapterDetailResponse {
    data?: {
        chapter?: ChapterDetail
    }
}

export interface SeriesSearchItem {
    id: number
    slug: string
    title: string
    cover: string
    status: string
    type: string
    rating: number
    chapter_count: number
    public_url: string
    latest_chapters?: SeriesChapter[]
}

export interface SeriesSearchResponse {
    data: SeriesSearchItem[]
    meta: {
        total: number
        per_page: number
    }
}

export interface TrendingItem {
    id: number
    slug: string
    title: string
    cover_url: string
    status: string
    type: string
    rating: number
    chapter_count: number
    public_url: string
}

export interface HomeFeedChapter {
    id: number
    name: string
    number: number
    title?: string | null
    published_at: string
    time_ago?: string
    comic_name: string
    comic_slug: string
    comic_public_url: string
    comic_cover: string
    type?: string
    is_premium?: boolean
    early_access_until?: string | null
}
