import {
    AdditionalInfoType,
    Chapter,
    ChapterData,
    Content,
    ContentRating,
    ContentType,
    Highlight,
    highlights as highlightInfo,
    links as linkInfo,
    PublicationStatus,
    ReadingMode,
    staff,
    Tag
} from '@mana-app/types'
import {
    MANGADOT_DOMAIN,
    MANGADOT_LANGUAGE,
    MangaDotChapter,
    MangaDotChapterMode,
    MangaDotChapterReference,
    MangaDotImagesResponse,
    MangaDotManga,
    MangaDotRelationsResponse,
    MangaDotSuggestionsResponse,
    MangaDotVolume
} from './MangaDotTypes'

const FALLBACK_COVER = `${MANGADOT_DOMAIN}/icon.png`
const VOLUME_CHAPTER_RANGE = 10_000

export function absoluteMangaDotUrl(value: string | null | undefined): string | undefined {
    const trimmed = value?.trim()
    if (!trimmed || (!trimmed.startsWith('/') && !/^https?:\/\//i.test(trimmed))) {
        return undefined
    }
    try {
        const url = new URL(trimmed, MANGADOT_DOMAIN)
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
    } catch {
        return undefined
    }
}

function safeExternalUrl(value: string | null | undefined): string | undefined {
    if (!value?.trim()) return undefined
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
    } catch {
        return undefined
    }
}

function truthyFlag(value: boolean | number | null | undefined): boolean {
    return value === true || value === 1
}

function numberValue(value: number | string | null | undefined, fallback = 0): number {
    const result = Number(value)
    return Number.isFinite(result) ? result : fallback
}

function parseDate(value: string | null | undefined): Date {
    const timestamp = value ? Date.parse(value) : Number.NaN
    return new Date(Number.isNaN(timestamp) ? 0 : timestamp)
}

export function parseStringList(value: string[] | string | null | undefined): string[] {
    if (Array.isArray(value)) {
        return value.map((item) => item.trim()).filter(Boolean)
    }
    if (!value?.trim()) return []

    try {
        const parsed = JSON.parse(value) as unknown
        if (Array.isArray(parsed)) {
            return parsed
                .filter((item): item is string => typeof item === 'string')
                .map((item) => item.trim())
                .filter(Boolean)
        }
    } catch {
        // Some catalogue entries use a plain comma-separated value.
    }

    return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const value of values) {
        const trimmed = value?.trim()
        if (!trimmed) continue
        const key = trimmed.toLocaleLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        result.push(trimmed)
    }
    return result
}

export function mapMangaDotContentRating(manga: MangaDotManga): ContentRating {
    const isAdult = truthyFlag(manga.is_adult) || truthyFlag(manga.is_blurworthy)
    switch (manga.content_rating?.toLocaleLowerCase()) {
        case 'pornographic':
            return ContentRating.EXPLICIT
        case 'erotica':
            return ContentRating.MATURE
        case 'suggestive':
            return isAdult ? ContentRating.MATURE : ContentRating.SUGGESTIVE
        case 'safe':
        default:
            return isAdult ? ContentRating.MATURE : ContentRating.SAFE
    }
}

export function mapMangaDotStatus(manga: MangaDotManga): PublicationStatus {
    if (manga.hiatus?.toLocaleLowerCase() === 'yes') return PublicationStatus.HIATUS
    switch (manga.status?.toLocaleLowerCase()) {
        case 'completed':
            return PublicationStatus.COMPLETED
        case 'hiatus':
            return PublicationStatus.HIATUS
        case 'cancelled':
        case 'canceled':
            return PublicationStatus.CANCELLED
        case 'ongoing':
        default:
            return PublicationStatus.ONGOING
    }
}

export function mapMangaDotType(origin: string | null | undefined): ContentType {
    switch (origin) {
        case 'JP':
            return ContentType.MANGA
        case 'KR':
            return ContentType.MANHWA
        case 'CN':
            return ContentType.MANHUA
        default:
            return ContentType.COMIC
    }
}

function readingMode(manga: MangaDotManga): ReadingMode {
    if (manga.is_longstrip) return ReadingMode.WEBTOON
    return manga.country_of_origin === 'JP'
        ? ReadingMode.PAGED_MANGA
        : ReadingMode.PAGED_COMIC
}

function externalLinks(manga: MangaDotManga) {
    const sourceUrl = safeExternalUrl(manga.source_url)
    return [
        sourceUrl ? linkInfo.item({ id: 'source', title: 'Source', url: sourceUrl }) : undefined,
        manga.anilist_id ? linkInfo.item({ id: 'anilist', title: 'AniList', url: `https://anilist.co/manga/${manga.anilist_id}` }) : undefined,
        manga.mal_id ? linkInfo.item({ id: 'mal', title: 'MyAnimeList', url: `https://myanimelist.net/manga/${manga.mal_id}` }) : undefined,
        manga.mangaupdates_id ? linkInfo.item({ id: 'mangaupdates', title: 'MangaUpdates', url: `https://www.mangaupdates.com/series/${manga.mangaupdates_id}` }) : undefined,
        manga.mangadex_id ? linkInfo.item({ id: 'mangadex', title: 'MangaDex', url: `https://mangadex.org/title/${manga.mangadex_id}` }) : undefined,
        manga.kitsu_id ? linkInfo.item({ id: 'kitsu', title: 'Kitsu', url: `https://kitsu.app/manga/${manga.kitsu_id}` }) : undefined,
        manga.mangabaka_id ? linkInfo.item({ id: 'mangabaka', title: 'MangaBaka', url: `https://mangabaka.org/${manga.mangabaka_id}` }) : undefined
    ].filter((item): item is NonNullable<typeof item> => item !== undefined)
}

function detailedTags(manga: MangaDotManga): string[] {
    return Array.isArray(manga.tags)
        ? manga.tags.flatMap((category) => category.tags ?? []).map((tag) => tag.name)
        : typeof manga.tags === 'string'
            ? manga.tags.split(',')
            : []
}

function provider(
    groupId: number | null | undefined,
    groupName: string | null | undefined,
    scanlatorName: string | null | undefined
): { id: string, name: string } | undefined {
    const name = groupName?.trim() || scanlatorName?.trim()
    if (!name) return undefined
    return {
        id: groupId && groupId > 0 ? String(groupId) : name.toLocaleLowerCase(),
        name
    }
}

export function parseScanlatorPriority(value: string): RegExp[] {
    const seen = new Set<string>()
    return value
        .split(',')
        .map((name) => name.trim())
        .filter((name) => {
            const key = name.toLocaleLowerCase()
            if (!key || seen.has(key)) return false
            seen.add(key)
            return true
        })
        .map((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'))
}

function scanlatorRank(name: string | undefined, priorities: RegExp[]): number {
    if (!name) return priorities.length
    const rank = priorities.findIndex((pattern) => pattern.test(name))
    return rank < 0 ? priorities.length : rank
}

export function encodeChapterReference(reference: MangaDotChapterReference): string {
    return `${reference.source === 'user' ? 'u' : 's'}:${reference.id}`
}

export function decodeChapterReference(value: string): MangaDotChapterReference {
    const match = /^([us]):(\d+)$/.exec(value)
    if (!match?.[1] || !match[2]) {
        throw new Error(`Invalid MangaDot chapter identifier: ${value}`)
    }
    return {
        source: match[1] === 'u' ? 'user' : 'scraper',
        id: match[2]
    }
}

export class MangaDotParser {
    parseHighlight(manga: MangaDotManga): Highlight {
        const latestChapter = numberValue(manga.latest_chapter_number)
        const rating = manga.avg_rating
        return {
            id: String(manga.id),
            title: manga.title,
            cover: absoluteMangaDotUrl(manga.photo) ?? FALLBACK_COVER,
            subtitle: latestChapter > 0 ? `Chapter ${latestChapter}` : undefined,
            contentRating: mapMangaDotContentRating(manga),
            ...(typeof rating === 'number' && Number.isFinite(rating) && rating > 0
                ? { badge: { text: `★ ${rating.toFixed(1)}` } }
                : {}),
            webUrl: `${MANGADOT_DOMAIN}/manga/${manga.id}`
        }
    }

    parseContent(
        manga: MangaDotManga,
        suggestions: MangaDotSuggestionsResponse,
        relations: MangaDotRelationsResponse,
        showDetailedTags: boolean
    ): Content {
        if (!manga.id || !manga.title?.trim()) {
            throw new Error('MangaDot returned invalid title details')
        }

        const tagNames = uniqueStrings([
            ...(manga.genres ?? []),
            ...(showDetailedTags ? detailedTags(manga) : [])
        ])
        const tags: Tag[] = tagNames.map((title) => ({ id: title, title }))
        const authors = parseStringList(manga.authors)
        const artists = parseStringList(manga.artists)
        const staffItems = [
            ...authors.map((name) => staff.item({ id: `author:${name}`, title: name, subtitle: 'Author' })),
            ...artists.map((name) => staff.item({ id: `artist:${name}`, title: name, subtitle: 'Artist' }))
        ]
        const links = externalLinks(manga)

        const related = new Map<string, Highlight>()
        const relationGroups = Array.isArray(relations.relations)
            ? []
            : Object.values(relations.relations ?? {})
        for (const items of relationGroups) {
            for (const item of items) {
                if (item.id !== manga.id) related.set(String(item.id), this.parseHighlight(item))
            }
        }
        for (const item of suggestions.suggestions ?? []) {
            const id = String(item.id)
            if (item.id !== manga.id && !related.has(id)) related.set(id, this.parseHighlight(item))
        }

        const additionalInfo = [
            ...(staffItems.length > 0 ? [staff.section({
                id: 'staff',
                title: 'Staff',
                hasMore: false,
                items: staffItems
            })] : []),
            ...(links.length > 0 ? [linkInfo.section({
                id: 'links',
                title: 'Links',
                items: links
            })] : []),
            ...(related.size > 0 ? [highlightInfo.section({
                id: 'related',
                title: 'Related Titles',
                hasMore: false,
                items: [...related.values()].map((item) => ({
                    type: AdditionalInfoType.Highlights,
                    id: item.id,
                    title: item.title,
                    cover: item.cover,
                    contentRating: item.contentRating,
                    webUrl: item.webUrl
                }))
            })] : [])
        ]

        const trackerInfo: Record<string, string> = {}
        if (manga.anilist_id) trackerInfo.anilist = String(manga.anilist_id)
        if (manga.mal_id) trackerInfo.mal = String(manga.mal_id)

        return {
            title: manga.title,
            cover: absoluteMangaDotUrl(manga.photo) ?? FALLBACK_COVER,
            webUrl: `${MANGADOT_DOMAIN}/manga/${manga.id}`,
            status: mapMangaDotStatus(manga),
            summary: manga.description?.trim() || undefined,
            additionalTitles: uniqueStrings(parseStringList(manga.alt_titles)),
            additionalCovers: uniqueStrings([
                absoluteMangaDotUrl(manga.banner_image),
                absoluteMangaDotUrl(manga.photo)
            ]),
            tags,
            contentType: mapMangaDotType(manga.country_of_origin),
            contentRating: mapMangaDotContentRating(manga),
            recommendedPanelMode: readingMode(manga),
            additionalInfo: additionalInfo.length > 0 ? additionalInfo : undefined,
            trackerInfo: Object.keys(trackerInfo).length > 0 ? trackerInfo : undefined
        }
    }

    parseChapters(
        chapters: MangaDotChapter[],
        volumes: MangaDotVolume[],
        mode: MangaDotChapterMode,
        preferredScanlators: RegExp[] = []
    ): Chapter[] {
        const mappedChapters = chapters
            .filter((chapter) => !chapter.language || chapter.language === 'en')
            .map((chapter) => {
                const source = chapter.source === 'user' ? 'user' : 'scraper'
                const number = numberValue(chapter.chapter_number)
                const volume = numberValue(chapter.volume_number)
                const date = parseDate(chapter.date_added)
                const chapterProvider = provider(chapter.group_id, chapter.group_name, chapter.scanlator_name)
                return {
                    id: chapter.id,
                    item: {
                        chapterId: encodeChapterReference({ source, id: String(chapter.id) }),
                        number,
                        index: 0,
                        language: MANGADOT_LANGUAGE,
                        date,
                        volume: volume || undefined,
                        title: chapter.chapter_title?.trim() || undefined,
                        provider: chapterProvider,
                        webUrl: source === 'user'
                            ? `${MANGADOT_DOMAIN}/chapter/${chapter.id}?source=user`
                            : `${MANGADOT_DOMAIN}/chapter/${chapter.id}`
                    } as Chapter
                }
            })
            .sort((left, right) =>
                left.item.number - right.item.number ||
                scanlatorRank(left.item.provider?.name, preferredScanlators) -
                    scanlatorRank(right.item.provider?.name, preferredScanlators) ||
                left.item.date.getTime() - right.item.date.getTime() ||
                (left.item.provider?.name ?? '').localeCompare(right.item.provider?.name ?? '') ||
                left.id - right.id
            )
            .map(({ item }) => item)

        const mappedVolumes = volumes
            .filter((volume) => !volume.language || volume.language === 'en')
            .map((volume) => {
                const volumeNumber = numberValue(volume.volume_number)
                return {
                    id: volume.id,
                    item: {
                        chapterId: encodeChapterReference({ source: 'user', id: String(volume.id) }),
                        number: volumeNumber * VOLUME_CHAPTER_RANGE,
                        index: 0,
                        language: MANGADOT_LANGUAGE,
                        date: parseDate(volume.date_added),
                        volume: volumeNumber || undefined,
                        title: `Full Volume ${volumeNumber || '?'}`,
                        provider: provider(volume.group_id, volume.group_name, volume.scanlator_name),
                        webUrl: `${MANGADOT_DOMAIN}/volume/${volume.id}`
                    } as Chapter
                }
            })
            .sort((left, right) =>
                (left.item.volume ?? 0) - (right.item.volume ?? 0) ||
                scanlatorRank(left.item.provider?.name, preferredScanlators) -
                    scanlatorRank(right.item.provider?.name, preferredScanlators) ||
                left.item.date.getTime() - right.item.date.getTime() ||
                left.id - right.id
            )
            .map(({ item }) => item)

        const selected = mode === 'chapters'
            ? mappedChapters
            : mode === 'volumes'
                ? (mappedVolumes.length > 0 ? mappedVolumes : mappedChapters)
                : [...mappedChapters, ...mappedVolumes]

        return selected.map((chapter, index) => ({ ...chapter, index }))
    }

    parseChapterData(response: MangaDotImagesResponse, contentId: string, chapterId: string): ChapterData {
        const pages = (response.images ?? []).flatMap((image) => {
            const url = absoluteMangaDotUrl(image.url)
            return url ? [{ url }] : []
        })
        if (pages.length === 0) {
            throw new Error(`MangaDot returned no pages for ${contentId}/${chapterId}`)
        }
        return { pages }
    }

    parsePagedResults(response: {
        manga_list?: MangaDotManga[]
        pagination?: {
            current_page?: number | null
            total_pages?: number | null
            total_results?: number | null
            total_manga?: number | null
            per_page?: number | null
            next_cursor?: string | null
        }
    }, requestedPage: number, pageSize: number) {
        const results = (response.manga_list ?? []).map((manga) => this.parseHighlight(manga))
        const pagination = response.pagination
        const currentPage = pagination?.current_page ?? requestedPage
        const totalPages = pagination?.total_pages
        const isLastPage = totalPages != null
            ? currentPage >= totalPages
            : pagination?.next_cursor == null && results.length < pageSize

        return {
            results,
            isLastPage: isLastPage || results.length === 0,
            totalResultCount: pagination?.total_results ?? pagination?.total_manga ?? undefined
        }
    }
}
