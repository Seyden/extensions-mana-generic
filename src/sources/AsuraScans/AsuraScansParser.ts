/* eslint-disable linebreak-style */
import {
    Chapter,
    ChapterData,
    ChapterPage,
    Content,
    ContentType,
    Highlight,
    Option,
    PublicationStatus,
    SearchForm,
    SearchListSection,
    SearchMultiPickerSheet,
    SearchPicker,
    SearchSortSection,
    Tag,
    staff,
    StaffSection,
    ReadingMode,
    ContentRating
} from '@mana-app/types'

import {
    ChapterDetail,
    Genre,
    SeriesChapter,
    SeriesDetail,
    SeriesSearchItem,
    statusOptions,
    TrendingItem,
    typeOptions
} from './AsuraScansInterfaces'

import moment from 'moment'
import { decode as decodeHTMLEntity } from 'html-entities'
import { load } from 'cheerio'

export class AsuraScansParser{
    async parseMangaDetails(data: { series?: SeriesDetail }, mangaId: string, source: any): Promise<Content> {
        const comic = data.series
        if (!comic) {
            throw new Error(`Failed to parse manga details (missing series) for ${mangaId}`)
        }

        const title = comic.title.trim()
        const author = comic.author?.trim()
        const artist = comic.artist?.trim()

        const image = comic.cover
        const covers = [comic.cover]
        let description = comic.description.trim()
        if (description != '') {
            description = decodeHTMLEntity(load(description).root().text().replace(/\\r\\n/gm, '\n'))
        }

        const rawStatus = comic.status?.trim() ?? ''
        let status
        switch (rawStatus.toLowerCase()) {
            case source.manga_StatusTypes.DROPPED.toLowerCase():
                status = PublicationStatus.CANCELLED
                break
            case source.manga_StatusTypes.ONGOING.toLowerCase():
                status = PublicationStatus.ONGOING
                break
            case source.manga_StatusTypes.COMPLETED.toLowerCase():
                status = PublicationStatus.COMPLETED
                break
            case source.manga_StatusTypes.HIATUS.toLowerCase():
                status = PublicationStatus.HIATUS
                break
            case source.manga_StatusTypes.SEASONEND.toLowerCase():
                status = PublicationStatus.HIATUS
                break
            case source.manga_StatusTypes.COMINGSOON.toLowerCase():
                status = PublicationStatus.ONGOING
                break
            default:
                status = PublicationStatus.ONGOING
                break
        }

        const tags: Tag[] = (Array.isArray(comic.genres) ? comic.genres : []).map((genre: any) => ({
            id: genre.id.toString(),
            title: genre.name
        }))

        const additionalInfo: StaffSection[] | undefined =
            author || artist ? [staff.section({
                id: "staff",
                title: "Staff",
                hasMore: false,
                items: [
                ...(author ? [staff.item({ id: author, title: author, subtitle: "Author" })] : []),
                ...(artist ? [staff.item({ id: artist, title: artist, subtitle: "Artist" })] : []),
                ],
            })] : undefined

        return {
            title: title,
            status,
            tags,
            summary: description,
            cover: image || source.fallbackImage,
            additionalCovers: covers,
            additionalInfo,
            //...(chapters.length > 0 && { chapters }),
            contentType: ContentType.MANHWA,
            contentRating: ContentRating.SUGGESTIVE,
            recommendedPanelMode: ReadingMode.WEBTOON
        }
    }

    async parseChapterList(data: SeriesChapter[], mangaId: string, source: any): Promise<Chapter[]> {
        if (data.length === 0) {
            throw new Error(`Failed to parse chapter list (empty chapters) for manga ${mangaId}`)
        }

        const chapters: Chapter[] = []
        let sortingIndex = 0

        for (const chapter of data.slice().reverse()) {
            const id = chapter.id?.toString()
            if (!id) {
                throw new Error(`Could not parse out ID when getting chapters for postId:${mangaId}`)
            }

            if (chapter.is_locked || chapter.is_premium) {
                continue
            }

            const title = chapter.title
            const number = chapter.number
            const publishedDate = chapter.published_at

            chapters.push({
                chapterId: id.toString(),
                language: source.language,
                number,
                title: !title ? `Chapter ${number}` : title,
                date: new Date(publishedDate),
                index: sortingIndex,
                volume: 0
            })
            sortingIndex++
        }

        return chapters
    }

    parseChapterDetails(data: ChapterDetail | undefined, mangaId: string): ChapterData {
        const pagesObj = data?.pages
        if (!Array.isArray(pagesObj) || pagesObj.length === 0) {
            throw new Error(`Failed to parse chapter pages for manga ${mangaId}`)
        }

        const pages: ChapterPage[] = pagesObj
                                         .map((page) => ({
                                             url: page.url,
                                             order: page.order ?? 0
                                         }))
                                         .sort((x: any) => x.order)
                                         .map((x: ChapterPage) => ({ url: x.url }))

        return {
            pages: pages
        }
    }

    parseTags(genres: Genre[]): SearchForm {
        const predefinedChaptersTags: Option[] = [
            { id: '10', title: '+10' },
            { id: '20', title: '+20' },
            { id: '30', title: '+30' },
            { id: '40', title: '+40' },
            { id: '50', title: '+50' },
            { id: '60', title: '+60' },
            { id: '70', title: '+70' },
            { id: '80', title: '+80' },
            { id: '90', title: '+90' },
            { id: '100', title: '+100' },
            { id: '150', title: '+150' },
            { id: '200', title: '+200' },
            { id: '250', title: '+250' },
        ]

        const toPreset = (items: { value: string; label: string }[]): Option[] =>
            items.map((item) => ({ id: item.value, title: item.label }))

        return {
            sections: [
                SearchListSection({
                    children: [SearchMultiPickerSheet({
                        id: 'genres',
                        title: 'Genres',
                        options: genres.map((g) => ({ id: `${g.id}`, title: g.name }))
                    })]
                }),
                SearchListSection({
                    header: 'Filters',
                    children: [
                        SearchPicker({
                            id: 'chapters',
                            title: 'Chapters',
                            options: predefinedChaptersTags
                        }),
                        SearchPicker({
                            id: 'status',
                            title: 'Status',
                            options: toPreset(statusOptions)
                        }),
                        SearchPicker({
                            id: 'type',
                            title: 'Type',
                            options: toPreset(typeOptions)
                        })
                    ]
                }),
                SearchSortSection({ header: 'Sort' })
            ]
        }
    }

    parseSeriesItems(items: SeriesSearchItem[], baseUrl: string, fallbackImage: string, detailed = false): Highlight[] {
        return items.map(item => {
            const chapters = item.latest_chapters ?? []
            const latest = chapters[0]
            return {
                ...this.highlight(item, item.cover, baseUrl, fallbackImage),
                subtitle: !detailed && latest ? `Chapter ${latest.number}${latest.is_premium ? ' 🔒' : ''}` : undefined,
                ...(detailed ? { info: chapters.map(chapter => {
                    const date = moment(chapter.published_at)
                    return {
                        key: `Chapter ${chapter.number}${chapter.is_premium ? ' 🔒' : ''}`,
                        value: chapter.published_at && date.isValid() ? date.fromNow() : ''
                    }
                }) } : {})
            }
        })
    }

    parseTrendingItems(items: TrendingItem[], baseUrl: string, fallbackImage: string): Highlight[] {
        return items.map(item => ({
            ...this.highlight(item, item.cover_url, baseUrl, fallbackImage),
            subtitle: item.latest_chapter_number != null ? `Chapter ${item.latest_chapter_number}` : undefined
        }))
    }

    private highlight(
        item: Pick<SeriesSearchItem, 'slug' | 'title' | 'public_url' | 'rating'>,
        cover: string,
        baseUrl: string,
        fallbackImage: string
    ): Highlight {
        return {
            id: item.slug,
            title: decodeHTMLEntity(item.title),
            cover: cover || fallbackImage,
            webUrl: item.public_url ? new URL(item.public_url, baseUrl).href : undefined,
            ...(typeof item.rating === 'number' && Number.isFinite(item.rating) && item.rating > 0
                ? { badge: { text: `★ ${item.rating.toFixed(1)}` } }
                : {})
        }
    }

}
