import {
    AdditionalInfoSection,
    Chapter,
    ChapterData,
    Content,
    ContentRating,
    ContentType,
    Highlight,
    links as linkInfo,
    PublicationStatus,
    ReadingMode,
    staff,
    Tag
} from '@mana-app/types'
import {
    ComixChapter,
    ComixContentRating,
    ComixManga,
    ComixMangaType,
    ComixPagedResponse,
    ComixPublicationStatus,
    ComixResolvedPage
} from './ComixInterfaces'
import { COMIX_DOMAIN, COMIX_LANGUAGE } from './ComixInfo'
import {
    ComixPosterQuality,
    ComixPreferences,
    DEFAULT_COMIX_PREFERENCES
} from './ComixPreferences'

const FALLBACK_COVER = 'https://comix.to/assets/uploads/35595e3de3c99889c1bd2c56f3e3714fc0c457.png'

function absoluteUrl(path: string | undefined): string | undefined {
    if (!path) return undefined

    try {
        return new URL(path, COMIX_DOMAIN).href
    } catch {
        return undefined
    }
}

function numericValue(value: number | string | null | undefined, fallback = 0): number {
    const result = Number(value)
    return Number.isFinite(result) ? result : fallback
}

function uniqueStrings(values: Array<string | undefined>): string[] {
    return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function trackerId(url: string | null | undefined, expression: RegExp): string | undefined {
    if (!url) return undefined
    return expression.exec(url)?.[1]
}

function posterUrl(manga: ComixManga, quality: ComixPosterQuality): string {
    const poster = manga.poster
    switch (quality) {
        case 'small':
            return poster?.small ?? poster?.medium ?? poster?.large ?? FALLBACK_COVER
        case 'medium':
            return poster?.medium ?? poster?.large ?? poster?.small ?? FALLBACK_COVER
        case 'large':
        default:
            return poster?.large ?? poster?.medium ?? poster?.small ?? FALLBACK_COVER
    }
}

function formattedScore(manga: ComixManga): string | undefined {
    const score = numericValue(manga.ratedAvg)
    if (score <= 0) return undefined

    const stars = Math.max(0, Math.min(5, Math.round(score / 2)))
    return `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)} ${score}/10`
}

function contentSummary(manga: ComixManga, preferences: ComixPreferences): string | undefined {
    const sections: string[] = []
    const score = preferences.scorePosition !== 'none'
        ? formattedScore(manga)
        : undefined

    if (score && preferences.scorePosition === 'top') sections.push(score)
    if (manga.synopsis?.trim()) sections.push(manga.synopsis.trim())

    if (
        preferences.showAlternativeTitlesInSummary &&
        (manga.altTitles?.length ?? 0) > 0
    ) {
        sections.push(`Alternative names:\n${manga.altTitles?.join('\n')}`)
    }

    if (preferences.showExtraInfo) {
        const extra: string[] = []
        if ((manga.year ?? 0) > 0) extra.push(`Year: ${manga.year}`)
        if (manga.originalLanguage?.trim()) {
            extra.push(`Language: ${manga.originalLanguage.toUpperCase()}`)
        }
        if (manga.contentRating) {
            extra.push(
                `Content rating: ${manga.contentRating[0]?.toUpperCase()}${manga.contentRating.slice(1)}`
            )
        }
        if ((manga.rank ?? 0) > 0) extra.push(`Rank: #${manga.rank}`)
        if ((manga.ratedCount ?? 0) > 0) extra.push(`Rated by: ${manga.ratedCount}`)
        if ((manga.followsTotal ?? 0) > 0) extra.push(`Followed by: ${manga.followsTotal}`)
        if (extra.length > 0) sections.push(extra.join('\n'))
    }

    if (score && preferences.scorePosition === 'bottom') sections.push(score)
    return sections.length > 0 ? sections.join('\n\n') : undefined
}

export function parseComixRelativeDate(value: string | undefined, now = Date.now()): Date {
    if (!value) return new Date(0)

    const trimmed = value.trim()
    const absoluteTimestamp = Date.parse(trimmed)
    if (!Number.isNaN(absoluteTimestamp) && !/\bago$/i.test(trimmed)) {
        return new Date(absoluteTimestamp)
    }

    if (/^(just now|now)$/i.test(trimmed)) {
        return new Date(now)
    }

    const relative = trimmed.toLowerCase().replace(/\s+ago$/, '')
    const match = /^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks|mo|mos|month|months|y|yr|yrs|year|years)$/i.exec(relative)
    if (!match) return new Date(0)

    const amount = Number(match[1])
    const unit = match[2]?.toLowerCase()
    const unitMilliseconds: Record<string, number> = {
        s: 1_000,
        sec: 1_000,
        secs: 1_000,
        second: 1_000,
        seconds: 1_000,
        m: 60_000,
        min: 60_000,
        mins: 60_000,
        minute: 60_000,
        minutes: 60_000,
        h: 3_600_000,
        hr: 3_600_000,
        hrs: 3_600_000,
        hour: 3_600_000,
        hours: 3_600_000,
        d: 86_400_000,
        day: 86_400_000,
        days: 86_400_000,
        w: 604_800_000,
        week: 604_800_000,
        weeks: 604_800_000,
        mo: 2_592_000_000,
        mos: 2_592_000_000,
        month: 2_592_000_000,
        months: 2_592_000_000,
        y: 31_536_000_000,
        yr: 31_536_000_000,
        yrs: 31_536_000_000,
        year: 31_536_000_000,
        years: 31_536_000_000
    }
    const multiplier = unit ? unitMilliseconds[unit] : undefined

    return multiplier ? new Date(now - amount * multiplier) : new Date(0)
}

function parseChapterDate(chapter: ComixChapter): Date {
    for (const value of [chapter.createdAt, chapter.created_at]) {
        if (!value) continue

        const timestamp = Date.parse(value)
        if (!Number.isNaN(timestamp) && !/\bago$/i.test(value)) {
            return new Date(timestamp)
        }
    }

    return parseComixRelativeDate(
        chapter.createdAtFormatted ?? chapter.createdAt ?? chapter.created_at
    )
}

export function mapComixContentRating(
    rating: ComixContentRating | undefined
): ContentRating {
    switch (rating) {
        case 'suggestive':
            return ContentRating.SUGGESTIVE
        case 'erotica':
            return ContentRating.MATURE
        case 'pornographic':
            return ContentRating.EXPLICIT
        case 'safe':
        default:
            return ContentRating.SAFE
    }
}

export function mapComixPublicationStatus(
    status: ComixPublicationStatus | undefined
): PublicationStatus {
    switch (status) {
        case 'finished':
            return PublicationStatus.COMPLETED
        case 'on_hiatus':
            return PublicationStatus.HIATUS
        case 'discontinued':
            return PublicationStatus.CANCELLED
        case 'not_yet_released':
        case 'releasing':
        default:
            return PublicationStatus.ONGOING
    }
}

export function mapComixContentType(type: ComixMangaType | undefined): ContentType {
    switch (type) {
        case 'manga':
            return ContentType.MANGA
        case 'manhwa':
            return ContentType.MANHWA
        case 'manhua':
            return ContentType.MANHUA
        case 'other':
        default:
            return ContentType.COMIC
    }
}

function readingMode(type: ComixMangaType | undefined): ReadingMode {
    switch (type) {
        case 'manhwa':
        case 'manhua':
            return ReadingMode.WEBTOON
        case 'manga':
            return ReadingMode.PAGED_MANGA
        default:
            return ReadingMode.PAGED_COMIC
    }
}

export class ComixParser {
    parseHighlight(
        manga: ComixManga,
        preferences: ComixPreferences = DEFAULT_COMIX_PREFERENCES
    ): Highlight {
        const latestChapter = numericValue(manga.latestChapter)

        return {
            id: manga.hid,
            title: manga.title,
            cover: posterUrl(manga, preferences.posterQuality),
            subtitle: latestChapter > 0 ? `Chapter ${latestChapter}` : undefined,
            contentRating: mapComixContentRating(manga.contentRating),
            webUrl: absoluteUrl(manga.url ?? `/title/${manga.hid}`),
            info: [
                ...(manga.type ? [{ key: 'Type', value: manga.type.toUpperCase() }] : []),
                ...(manga.status ? [{ key: 'Status', value: manga.status.replace(/_/g, ' ') }] : [])
            ]
        }
    }

    parseContent(
        manga: ComixManga,
        preferences: ComixPreferences = DEFAULT_COMIX_PREFERENCES
    ): Content {
        if (!manga.hid || !manga.title) {
            throw new Error('Comix returned an invalid title detail response')
        }

        const properties = [
            ...(manga.genres ?? []),
            ...(manga.demographics ?? []),
            ...(manga.formats ?? []),
            ...(preferences.showNarrativeTags ? manga.tags ?? [] : [])
        ]
        const seenTags = new Set<string>()
        const tags: Tag[] = properties.flatMap((property) => {
            const id = `${property.id}`
            if (seenTags.has(id)) return []
            seenTags.add(id)
            return [{ id, title: property.title }]
        })

        const staffItems = [
            ...(manga.authors ?? []).map((person) =>
                staff.item({ id: `author:${person.id}`, title: person.title, subtitle: 'Author' })
            ),
            ...(manga.artists ?? []).map((person) =>
                staff.item({ id: `artist:${person.id}`, title: person.title, subtitle: 'Artist' })
            ),
            ...(manga.publishers ?? []).map((person) =>
                staff.item({ id: `publisher:${person.id}`, title: person.title, subtitle: 'Publisher' })
            )
        ]

        const externalLinks = [
            ...(manga.links?.al ? [linkInfo.item({ id: 'anilist', title: 'AniList', url: manga.links.al })] : []),
            ...(manga.links?.mal ? [linkInfo.item({ id: 'mal', title: 'MyAnimeList', url: manga.links.mal })] : []),
            ...(manga.links?.mu ? [linkInfo.item({ id: 'mangaupdates', title: 'MangaUpdates', url: manga.links.mu })] : []),
            ...(manga.links?.md ? [linkInfo.item({ id: 'mangadex', title: 'MangaDex', url: manga.links.md })] : []),
            ...(manga.links?.mb ? [linkInfo.item({ id: 'mangabaka', title: 'MangaBaka', url: manga.links.mb })] : []),
            ...(manga.sources ?? []).map((source, index) =>
                linkInfo.item({ id: `source:${index}`, title: source.label, url: source.url })
            )
        ]
        const additionalInfo: AdditionalInfoSection[] = [
            ...(staffItems.length > 0 ? [staff.section({
                id: 'staff',
                title: 'Staff',
                hasMore: false,
                items: staffItems
            })] : []),
            ...(externalLinks.length > 0 ? [linkInfo.section({
                id: 'links',
                title: 'Links',
                items: externalLinks
            })] : [])
        ]

        const trackerInfo: Record<string, string> = {}
        const anilistId = trackerId(manga.links?.al, /\/manga\/(\d+)/)
        const malId = trackerId(manga.links?.mal, /\/manga\/(\d+)/)
        if (anilistId) trackerInfo.anilist = anilistId
        if (malId) trackerInfo.mal = malId

        const covers = uniqueStrings([
            manga.poster?.large,
            manga.poster?.medium,
            manga.poster?.small
        ])

        return {
            title: manga.title,
            cover: posterUrl(manga, preferences.posterQuality),
            webUrl: absoluteUrl(manga.url ?? `/title/${manga.hid}`),
            status: mapComixPublicationStatus(manga.status),
            summary: contentSummary(manga, preferences),
            additionalTitles: manga.altTitles ?? [],
            additionalCovers: covers,
            tags,
            contentType: mapComixContentType(manga.type),
            contentRating: mapComixContentRating(manga.contentRating),
            recommendedPanelMode: readingMode(manga.type),
            additionalInfo: additionalInfo.length > 0 ? additionalInfo : undefined,
            trackerInfo: Object.keys(trackerInfo).length > 0 ? trackerInfo : undefined
        }
    }

    parseChapters(
        chapters: ComixChapter[],
        mangaId: string,
        preferences: ComixPreferences = DEFAULT_COMIX_PREFERENCES
    ): Chapter[] {
        const blacklist = new Set(
            preferences.scanlatorBlacklist
                .split(',')
                .map((value) => value.trim().toLowerCase())
                .filter(Boolean)
        )
        const filtered = chapters.filter((chapter) => {
            if (blacklist.size === 0) return true

            const providerName = chapter.group?.name ??
                (chapter.isOfficial ? 'Official' : 'Unknown')
            const providerId = chapter.group?.id
            return !blacklist.has(providerName.trim().toLowerCase()) &&
                !blacklist.has(`${providerId ?? ''}`.toLowerCase())
        })
        const selected = preferences.deduplicateChapters
            ? this.deduplicateChapters(filtered)
            : filtered
        const normalized = selected.map((chapter) => {
            const chapterId = `${chapter.id ?? ''}`
            const number = numericValue(chapter.number, Number.NaN)
            if (!chapterId || !Number.isFinite(number)) {
                throw new Error(`Comix returned an invalid chapter for ${mangaId}`)
            }

            return {
                chapter,
                chapterId,
                number,
                volume: numericValue(chapter.volume),
                date: parseChapterDate(chapter)
            }
        }).sort((left, right) =>
            left.number - right.number ||
            left.volume - right.volume ||
            left.date.getTime() - right.date.getTime() ||
            left.chapterId.localeCompare(right.chapterId)
        )

        return normalized.map(({ chapter, chapterId, number, volume, date }, index) => {
            const group = chapter.group
            const provider = group ? {
                id: `${group.id}`,
                name: group.name || 'Unknown group'
            } : chapter.isOfficial ? {
                id: 'official',
                name: 'Official'
            } : undefined

            return {
                chapterId,
                number,
                index,
                language: COMIX_LANGUAGE,
                date,
                title: chapter.name?.trim() || undefined,
                volume: volume > 0 ? volume : undefined,
                webUrl: absoluteUrl(chapter.url),
                provider
            }
        })
    }

    private deduplicateChapters(chapters: ComixChapter[]): ComixChapter[] {
        const selected = new Map<number, ComixChapter>()

        for (const chapter of chapters) {
            const number = numericValue(chapter.number, Number.NaN)
            if (!Number.isFinite(number)) continue

            const current = selected.get(number)
            if (!current || this.isBetterChapterRelease(chapter, current)) {
                selected.set(number, chapter)
            }
        }

        return [...selected.values()]
    }

    private isBetterChapterRelease(
        candidate: ComixChapter,
        current: ComixChapter
    ): boolean {
        if (candidate.isOfficial !== current.isOfficial) {
            return candidate.isOfficial === true
        }

        const candidateIsPreferredGroup = `${candidate.group?.id ?? ''}` === '10702'
        const currentIsPreferredGroup = `${current.group?.id ?? ''}` === '10702'
        if (candidateIsPreferredGroup !== currentIsPreferredGroup) {
            return candidateIsPreferredGroup
        }

        const candidateVotes = numericValue(candidate.votes)
        const currentVotes = numericValue(current.votes)
        if (candidateVotes !== currentVotes) {
            return candidateVotes > currentVotes
        }

        return numericValue(candidate.id) > numericValue(current.id)
    }

    parseChapterData(pages: ComixResolvedPage[], mangaId: string, chapterId: string): ChapterData {
        const normalizedPages = pages
            .filter((page) => Boolean(page.url || page.raw))
            .map((page) => page.raw ? { raw: page.raw } : { url: page.url })

        if (normalizedPages.length === 0) {
            throw new Error(`Comix returned no pages for ${mangaId}/${chapterId}`)
        }

        return { pages: normalizedPages }
    }

    parsePagedResults(
        response: ComixPagedResponse<ComixManga>,
        preferences: ComixPreferences = DEFAULT_COMIX_PREFERENCES
    ): {
        results: Highlight[]
        isLastPage: boolean
        totalResultCount?: number
    } {
        const results = (response.items ?? []).map((manga) =>
            this.parseHighlight(manga, preferences)
        )
        const meta = response.meta

        return {
            results,
            isLastPage: meta?.hasNext === false ||
                (typeof meta?.page === 'number' &&
                    typeof meta.lastPage === 'number' &&
                    meta.page >= meta.lastPage) ||
                results.length === 0,
            totalResultCount: meta?.total
        }
    }
}
