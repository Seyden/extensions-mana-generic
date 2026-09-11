import {
    AdditionalInfoSection,
    AdditionalInfoType,
    Chapter,
    ChapterData,
    Content,
    ContentRating,
    ContentType,
    Highlight,
    highlights,
    links,
    PublicationStatus,
    ReadingMode,
    SimpleHighlight,
    staff,
    tags as tagInfo
} from '@mana-app/types'
import {
    ATSUMARU_BASE_URL,
    ATSUMARU_ICON_URL,
    ATSUMARU_LANGUAGE
} from './AtsumaruApi'
import {
    AtsumaruChapter,
    AtsumaruContentRating,
    AtsumaruImage,
    AtsumaruImageSet,
    AtsumaruManga,
    AtsumaruPage,
    AtsumaruPerson,
    AtsumaruScanlator,
    AtsumaruTaxonomyItem
} from './AtsumaruTypes'

interface NamedTaxonomyItem {
    id: string
    name: string
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function imageSet(value: AtsumaruImage | undefined): AtsumaruImageSet | undefined {
    return value && typeof value === 'object' ? value : undefined
}

function primitiveImage(value: AtsumaruImage | undefined): string | undefined {
    return typeof value === 'string' ? value : undefined
}

export function normalizeAtsumaruAssetUrl(value: string | null | undefined): string | undefined {
    const trimmed = value?.trim()
    if (!trimmed) return undefined

    if (/^https?:?\/\//i.test(trimmed)) {
        return trimmed.replace(/^https?:?\/\//i, 'https://')
    }
    if (trimmed.startsWith('//')) return `https:${trimmed}`

    const path = trimmed.replace(/^\/+/, '').replace(/^static\//, '')
    return `${ATSUMARU_BASE_URL}/static/${path}`
}

function imageCandidates(manga: AtsumaruManga): string[] {
    const poster = imageSet(manga.poster)
    const image = imageSet(manga.image)

    return uniqueStrings([
        manga.largeImage,
        poster?.largeImage,
        image?.largeImage,
        manga.mediumImage,
        poster?.mediumImage,
        image?.mediumImage,
        primitiveImage(manga.poster),
        primitiveImage(manga.image),
        poster?.image,
        image?.image,
        manga.smallImage,
        poster?.smallImage,
        image?.smallImage
    ]).map((value) => normalizeAtsumaruAssetUrl(value) as string)
}

function namedTaxonomy(
    values: Array<string | AtsumaruTaxonomyItem> | null | undefined
): NamedTaxonomyItem[] {
    const seen = new Set<string>()

    return (values ?? []).flatMap((value) => {
        const name = typeof value === 'string' ? value.trim() : value.name?.trim()
        if (!name) return []

        const id = typeof value === 'string' ? name : value.id || name
        if (seen.has(id)) return []
        seen.add(id)
        return [{ id, name }]
    })
}

function people(values: AtsumaruManga['authors']): AtsumaruPerson[] {
    return (values ?? []).flatMap((value) => {
        if (typeof value === 'string') {
            return value.trim() ? [{ name: value.trim(), type: 'Author' }] : []
        }
        return value.name?.trim() ? [value] : []
    })
}

function numericValue(value: number | string | null | undefined): number | undefined {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

function releaseYear(manga: AtsumaruManga): number | undefined {
    const direct = manga.releaseYear ?? manga.year
    if (direct && direct > 0) return direct

    const released = numericValue(manga.released)
    if (!released || released <= 0) return undefined
    const timestamp = released < 10_000_000_000 ? released * 1_000 : released
    const year = new Date(timestamp).getUTCFullYear()
    return Number.isFinite(year) ? year : undefined
}

function averageRating(manga: AtsumaruManga): number | undefined {
    const value = manga.avgRating ?? manga.mbRating
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : undefined
}

function summary(manga: AtsumaruManga): string | undefined {
    const metadata: string[] = []
    const rating = averageRating(manga)
    const year = releaseYear(manga)

    if (rating) metadata.push(`Rating: ${rating.toFixed(2)}/10`)
    if (year) metadata.push(`Year: ${year}`)
    if (manga.views !== null && manga.views !== undefined && `${manga.views}`) {
        metadata.push(`Views: ${manga.views}`)
    }

    const sections = [
        metadata.length > 0 ? metadata.join('\n') : undefined,
        manga.synopsis?.trim() || undefined
    ].filter((value): value is string => Boolean(value))

    return sections.length > 0 ? sections.join('\n\n') : undefined
}

export function mapAtsumaruContentRating(
    rating: AtsumaruContentRating | string | null | undefined,
    isAdult = false
): ContentRating {
    switch (rating?.toLowerCase()) {
        case 'suggestive':
            return ContentRating.SUGGESTIVE
        case 'erotica':
            return ContentRating.MATURE
        case 'pornographic':
            return ContentRating.EXPLICIT
        case 'safe':
            return ContentRating.SAFE
        default:
            return isAdult ? ContentRating.EXPLICIT : ContentRating.SAFE
    }
}

export function mapAtsumaruContentType(type: string | null | undefined): ContentType {
    switch (type?.toLowerCase()) {
        case 'manga':
            return ContentType.MANGA
        case 'manwha':
        case 'manhwa':
            return ContentType.MANHWA
        case 'manhua':
            return ContentType.MANHUA
        default:
            return ContentType.COMIC
    }
}

function ratingBadgeText(manga: AtsumaruManga): string | undefined {
    const rating = averageRating(manga)
    const parts = rating ? [`★ ${Number(rating.toFixed(2))}`] : []
    if (manga.isAdult || manga.mbContentRating?.toLowerCase() === 'pornographic') {
        parts.push('18+')
    }
    return parts.length > 0 ? parts.join(' | ') : undefined
}

export function mapAtsumaruStatus(
    status: string | null | undefined
): PublicationStatus | undefined {
    switch (status?.toLowerCase()) {
        case 'ongoing':
            return PublicationStatus.ONGOING
        case 'completed':
            return PublicationStatus.COMPLETED
        case 'hiatus':
            return PublicationStatus.HIATUS
        case 'canceled':
        case 'cancelled':
            return PublicationStatus.CANCELLED
        default:
            return undefined
    }
}

function readingMode(type: string | null | undefined): ReadingMode {
    switch (mapAtsumaruContentType(type)) {
        case ContentType.MANGA:
            return ReadingMode.PAGED_MANGA
        case ContentType.MANHWA:
        case ContentType.MANHUA:
            return ReadingMode.WEBTOON
        default:
            return ReadingMode.PAGED_COMIC
    }
}

function externalLinks(manga: AtsumaruManga) {
    return [
        ...(manga.anilistId ? [links.item({
            id: 'anilist',
            title: 'AniList',
            url: `https://anilist.co/manga/${manga.anilistId}`
        })] : []),
        ...(manga.malId ? [links.item({
            id: 'mal',
            title: 'MyAnimeList',
            url: `https://myanimelist.net/manga/${manga.malId}`
        })] : []),
        ...(manga.kitsuId ? [links.item({
            id: 'kitsu',
            title: 'Kitsu',
            url: `https://kitsu.io/manga/${manga.kitsuId}`
        })] : []),
        ...(manga.mangaUpdatesId ? [links.item({
            id: 'manga-updates',
            title: 'MangaUpdates',
            url: `https://www.mangaupdates.com/series/${manga.mangaUpdatesId}`
        })] : []),
        ...(manga.annId ? [links.item({
            id: 'ann',
            title: 'Anime News Network',
            url: `https://www.animenewsnetwork.com/encyclopedia/manga.php?id=${manga.annId}`
        })] : []),
        ...(manga.kenmeiUrl ? [links.item({
            id: 'kenmei',
            title: 'Kenmei',
            url: manga.kenmeiUrl
        })] : [])
    ]
}

function relatedManga(manga: AtsumaruManga): AtsumaruManga[] {
    const seen = new Set<string>([manga.id])
    const values = [
        ...(manga.relations ?? []).map((relation) => relation.manga),
        ...(manga.recommendations ?? []),
        ...(manga.similarManga ?? [])
    ]

    return values.filter((item) => {
        if (!item.id || seen.has(item.id)) return false
        seen.add(item.id)
        return true
    })
}

function dateValue(
    value: number | string | null | undefined
): Date | undefined {
    if (typeof value === 'number') {
        const timestamp = value < 10_000_000_000 ? value * 1_000 : value
        const date = new Date(timestamp)
        return Number.isNaN(date.getTime()) ? undefined : date
    }
    if (typeof value === 'string') {
        const numeric = numericValue(value)
        if (numeric !== undefined && /^\d+$/.test(value.trim())) {
            const timestamp = numeric < 10_000_000_000 ? numeric * 1_000 : numeric
            const date = new Date(timestamp)
            return Number.isNaN(date.getTime()) ? undefined : date
        }
        const timestamp = Date.parse(value)
        if (!Number.isNaN(timestamp)) return new Date(timestamp)
    }
    return undefined
}

export function formatAtsumaruRelativeTime(
    value: number | string | null | undefined,
    now = Date.now()
): string | undefined {
    const date = dateValue(value)
    if (!date) return undefined

    const difference = date.getTime() - now
    const duration = Math.abs(difference) / 1_000
    if (duration < 5) return 'just now'

    let amount: number
    let unit: string
    if (duration < 60) {
        amount = Math.round(difference / 1_000)
        unit = 's'
    } else if (duration < 3_600) {
        amount = Math.round(difference / 60_000)
        unit = 'm'
    } else if (duration < 86_400) {
        amount = Math.round(difference / 3_600_000)
        unit = 'h'
    } else if (duration < 86_400 * 30) {
        amount = Math.round(difference / 86_400_000)
        unit = 'd'
    } else if (duration < 86_400 * 365) {
        amount = Math.round(difference / (86_400_000 * 30))
        unit = 'mo'
    } else {
        amount = Math.round(difference / (86_400_000 * 365))
        unit = 'y'
    }

    const relative = `${new Intl.NumberFormat('en-US').format(Math.abs(amount))}${unit}`
    return amount < 0 ? `${relative} ago` : `in ${relative}`
}

function chapterDate(value: number | string | null | undefined): Date {
    return dateValue(value) ?? new Date(0)
}

export class AtsumaruParser {
    parseHighlight(
        manga: AtsumaruManga,
        badge: 'rating' | 'updated' = 'rating'
    ): Highlight {
        if (!manga.id || !manga.title) {
            throw new Error('Atsumaru returned an invalid title listing')
        }

        const rating = averageRating(manga)
        const badgeText = badge === 'updated'
            ? formatAtsumaruRelativeTime(manga.updatedAt)
            : ratingBadgeText(manga)
        return {
            id: manga.id,
            title: manga.title,
            cover: imageCandidates(manga)[0] ?? ATSUMARU_ICON_URL,
            badge: badgeText ? { text: badgeText } : undefined,
            contentRating: mapAtsumaruContentRating(
                manga.mbContentRating,
                manga.isAdult
            ),
            info: [
                ...(manga.status ? [{ key: 'Status', value: manga.status }] : []),
                ...(rating ? [{ key: 'Rating', value: `${rating.toFixed(2)}/10` }] : [])
            ]
        }
    }

    parseContent(manga: AtsumaruManga): Content {
        if (!manga.id || !manga.title) {
            throw new Error('Atsumaru returned invalid title details')
        }

        const covers = imageCandidates(manga)
        const cover = covers[0] ?? ATSUMARU_ICON_URL
        const genres = namedTaxonomy(manga.genres)
        const narrativeTags = namedTaxonomy(manga.tags)
        const staffItems = people(manga.authors).map((person, index) =>
            staff.item({
                id: person.id ?? `${person.type ?? 'staff'}:${index}:${person.name}`,
                title: person.name,
                subtitle: person.type ?? 'Author'
            })
        )
        const relatedItems: SimpleHighlight[] = relatedManga(manga).map((item) => {
            const highlight = this.parseHighlight(item)
            return {
                type: AdditionalInfoType.Highlights,
                id: highlight.id,
                title: highlight.title,
                cover: highlight.cover,
                contentRating: highlight.contentRating
            }
        })
        const linkItems = externalLinks(manga)
        const additionalInfo: AdditionalInfoSection[] = [
            ...(staffItems.length > 0 ? [staff.section({
                id: 'staff',
                title: 'Staff',
                hasMore: false,
                items: staffItems
            })] : []),
            ...(narrativeTags.length > 0 ? [tagInfo.section({
                id: 'tags',
                title: 'Tags',
                items: narrativeTags.map((tag) =>
                    tagInfo.item({ id: tag.id, title: tag.name })
                )
            })] : []),
            ...(relatedItems.length > 0 ? [highlights.section({
                id: 'related',
                title: 'Related Titles',
                hasMore: false,
                items: relatedItems
            })] : []),
            ...(linkItems.length > 0 ? [links.section({
                id: 'links',
                title: 'Links',
                items: linkItems
            })] : [])
        ]
        const trackerInfo: Record<string, string> = {}
        if (manga.anilistId) trackerInfo.anilist = `${manga.anilistId}`
        if (manga.malId) trackerInfo.mal = `${manga.malId}`

        return {
            title: manga.title,
            cover,
            additionalCovers: covers.filter((value) => value !== cover),
            additionalTitles: uniqueStrings([
                manga.englishTitle,
                ...(manga.otherNames ?? [])
            ]).filter((title) => title !== manga.title),
            summary: summary(manga),
            status: mapAtsumaruStatus(manga.status),
            tags: genres.map((genre) => ({ id: genre.id, title: genre.name })),
            contentType: mapAtsumaruContentType(manga.type),
            contentRating: mapAtsumaruContentRating(
                manga.mbContentRating,
                manga.isAdult
            ),
            recommendedPanelMode: readingMode(manga.type),
            additionalInfo: additionalInfo.length > 0 ? additionalInfo : undefined,
            trackerInfo: Object.keys(trackerInfo).length > 0 ? trackerInfo : undefined
        }
    }

    parseChapters(
        chapters: AtsumaruChapter[],
        scanlators: AtsumaruScanlator[],
        mangaId: string
    ): Chapter[] {
        const scanlatorNames = new Map(
            scanlators.map((scanlator) => [scanlator.id, scanlator.name])
        )
        const normalized = chapters.map((chapter) => {
            const number = Number(chapter.number)
            if (!chapter.id || !Number.isFinite(number)) {
                throw new Error(`Atsumaru returned an invalid chapter for ${mangaId}`)
            }

            const providerId = chapter.scanlationMangaId ?? undefined
            const providerName = providerId
                ? scanlatorNames.get(providerId) ?? 'Unknown scanlator'
                : undefined

            return {
                chapter,
                number,
                date: chapterDate(chapter.createdAt),
                providerId,
                providerName
            }
        }).sort((left, right) =>
            left.number - right.number ||
            left.date.getTime() - right.date.getTime() ||
            (left.providerName ?? '').localeCompare(right.providerName ?? '') ||
            left.chapter.id.localeCompare(right.chapter.id)
        )

        return normalized.map((item, index) => ({
            chapterId: item.chapter.id,
            number: item.number,
            index,
            language: ATSUMARU_LANGUAGE,
            date: item.date,
            title: item.chapter.title?.trim() || undefined,
            provider: item.providerId ? {
                id: item.providerId,
                name: item.providerName as string
            } : undefined
        }))
    }

    parseChapterData(
        pages: AtsumaruPage[] | null | undefined,
        mangaId: string,
        chapterId: string
    ): ChapterData {
        const normalized = (pages ?? []).flatMap((page) => {
            const url = normalizeAtsumaruAssetUrl(page.image)
            return url ? [{ url }] : []
        })

        if (normalized.length === 0) {
            throw new Error(`Atsumaru returned no pages for ${mangaId}/${chapterId}`)
        }

        return { pages: normalized }
    }
}
