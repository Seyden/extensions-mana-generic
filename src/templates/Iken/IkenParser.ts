import {
    Chapter,
    ChapterData,
    Content,
    ContentType,
    Highlight,
    PublicationStatus,
    ReadingMode,
    SectionStyle,
    staff
} from '@mana-app/types'
import { decode } from 'html-entities'
import moment from 'moment'
import {
    IkenChapter,
    IkenChapterData,
    IkenPost
} from './IkenInterfaces'

export class IkenParser {
    parseHighlights(
        posts: IkenPost[],
        fallbackImage: string,
        style?: SectionStyle,
        now = Date.now()
    ): Highlight[] {
        return posts
            .filter((post) => !this.isNovel(post))
            .map((post) => {
                const isDetailed = style === SectionStyle.DetailedVerticalList
                    || style === SectionStyle.DetailedVerticalListGrouped
                const chapters = post.chapters ?? []
                const chapter = chapters[0]

                return {
                    id: post.id.toString(),
                    title: post.postTitle.trim(),
                    cover: post.featuredImage || fallbackImage,
                    ...(isDetailed && chapters.length > 0 ? {
                        info: chapters.map((chapter) => ({
                            key: this.formatChapterLabel(chapter),
                            value: formatIkenRelativeDate(chapter.createdAt, now)
                        }))
                    } : chapter ? {
                        subtitle: this.formatChapterLabel(chapter)
                    } : {})
                }
            })
    }

    parseContent(post: IkenPost, fallbackImage: string): Content {
        if (this.isNovel(post)) {
            throw new Error('Novels are not supported by this source')
        }

        const title = post.postTitle.trim()
        const alternativeTitle = post.alternativeTitles?.trim()
        const author = post.author?.trim()
        const artist = post.artist?.trim()
        const staffItems = [
            ...(author ? [staff.item({ id: `author:${author}`, title: author, subtitle: 'Author' })] : []),
            ...(artist ? [staff.item({ id: `artist:${artist}`, title: artist, subtitle: 'Artist' })] : [])
        ]

        return {
            title,
            cover: post.featuredImage || fallbackImage,
            status: mapIkenPublicationStatus(post.seriesStatus),
            contentType: mapIkenContentType(post.seriesType),
            recommendedPanelMode: ReadingMode.WEBTOON,
            summary: cleanDescription(post.postContent),
            additionalTitles: alternativeTitle && alternativeTitle.toLowerCase() !== title.toLowerCase()
                ? [alternativeTitle]
                : [],
            tags: (post.genres ?? []).map((genre) => ({
                id: genre.id.toString(),
                title: genre.name
            })),
            ...(staffItems.length > 0 ? {
                additionalInfo: [staff.section({
                    id: 'staff',
                    title: 'Staff',
                    hasMore: false,
                    items: staffItems
                })]
            } : {})
        }
    }

    parseChapters(chapters: IkenChapter[], language: string): Chapter[] {
        return chapters
            .filter((chapter) => !this.isChapterLocked(chapter))
            .map((chapter) => ({
                chapter,
                number: this.parseChapterNumber(chapter.number)
            }))
            .sort((left, right) => {
                const numberDifference = left.number - right.number
                if (numberDifference !== 0) return numberDifference

                return this.parseDate(left.chapter.createdAt).getTime()
                    - this.parseDate(right.chapter.createdAt).getTime()
            })
            .map(({ chapter, number }, index) => {
                const chapterTitle = chapter.title?.trim()

                return {
                    chapterId: chapter.id.toString(),
                    number,
                    index,
                    date: this.parseDate(chapter.createdAt),
                    language,
                    volume: 0,
                    title: chapterTitle ? `Chapter ${number} - ${chapterTitle}` : `Chapter ${number}`
                }
            })
    }

    parseChapterData(chapter: IkenChapterData, sortPagesByFilename: boolean): ChapterData {
        if (this.isChapterDataLocked(chapter)) {
            throw new Error('This chapter is locked or inaccessible')
        }

        const images = chapter.images
        if (!Array.isArray(images) || images.length === 0) {
            throw new Error('No chapter pages were returned')
        }

        const sortedImages = images.slice().sort((left, right) => {
            if (sortPagesByFilename) {
                return pageNumberFromUrl(left.url) - pageNumberFromUrl(right.url)
            }

            return (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
        })

        return {
            pages: sortedImages.map((image) => ({
                url: image.url.replace(/ /g, '%20')
            }))
        }
    }

    isChapterLocked(chapter: IkenChapter): boolean {
        const requiresPurchase = (chapter.price ?? 0) > 0 && chapter.chapterPurchased !== true

        return chapter.isAccessible === false
            || chapter.isLocked === true
            || chapter.isTimeLocked === true
            || chapter.isPermanentlyLocked === true
            || chapter.isShortLinkLocked === true
            || requiresPurchase
    }

    private formatChapterLabel(chapter: IkenChapter): string {
        const lock = this.isChapterLocked(chapter) ? '🔒 ' : ''
        return `${lock}Chapter ${this.parseChapterNumber(chapter.number)}`
    }

    private isChapterDataLocked(chapter: IkenChapterData): boolean {
        return chapter.isAccessible === false
            || chapter.isLocked === true
            || chapter.isLockedByCoins === true
            || chapter.isPermanentlyLocked === true
            || chapter.isShortLinkLocked === true
    }

    private isNovel(post: IkenPost): boolean {
        return post.isNovel === true || post.seriesType?.toUpperCase() === 'NOVEL'
    }

    private parseChapterNumber(value: number | string): number {
        const number = Number(value)
        if (!Number.isFinite(number)) {
            throw new Error(`Invalid chapter number: ${value}`)
        }

        return number
    }

    private parseDate(value: string | null | undefined): Date {
        const timestamp = value ? Date.parse(value) : NaN
        return new Date(Number.isNaN(timestamp) ? 0 : timestamp)
    }
}

export function mapIkenPublicationStatus(value: string | null | undefined): PublicationStatus {
    switch (value?.toUpperCase()) {
        case 'COMPLETED':
            return PublicationStatus.COMPLETED
        case 'CANCELLED':
        case 'CANCELED':
        case 'DROPPED':
            return PublicationStatus.CANCELLED
        case 'HIATUS':
            return PublicationStatus.HIATUS
        case 'ONGOING':
        case 'COMING_SOON':
        case 'MASS_RELEASED':
        default:
            return PublicationStatus.ONGOING
    }
}

export function mapIkenContentType(value: string | null | undefined): ContentType {
    switch (value?.toUpperCase()) {
        case 'MANGA':
            return ContentType.MANGA
        case 'MANHUA':
            return ContentType.MANHUA
        case 'MANHWA':
            return ContentType.MANHWA
        default:
            return ContentType.COMIC
    }
}

function cleanDescription(value: string | null | undefined): string {
    if (!value) return ''

    return decode(value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, ''))
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function pageNumberFromUrl(url: string): number {
    const filename = url.split('/').pop() ?? ''
    const match = filename.match(/page[-_ ]*(\d+)/i) ?? filename.match(/\d+/)
    const value = match?.[1] ?? match?.[0]
    return value ? Number(value) : Number.MAX_SAFE_INTEGER
}

export function formatIkenRelativeDate(value: string | null | undefined, now = Date.now()): string {
    const chapterDate = moment(value)
    if (!value || !chapterDate.isValid()) return ''

    return chapterDate.from(moment(now))
}
