/* eslint-disable linebreak-style */
import {
    Chapter,
    ChapterData,
    ChapterPage,
    Content,
    ContentType,
    FilterType,
    Highlight,
    Option,
    PublicationStatus,
    SearchFilter,
    SectionStyle,
    Tag,
    staff,
    StaffSection,
    ReadingMode
} from '@mana-app/types'

import {
    HomeSectionData
} from './AsuraScansHelper'

import {
    ChapterDetail,
    Genre,
    HomeFeedChapter,
    orderOptions,
    SeriesChapter,
    SeriesDetail,
    SeriesSearchItem,
    statusOptions,
    TrendingItem,
    typeOptions
} from './AsuraScansInterfaces'

import { parseAstroIsland } from './AstroIslandProps'
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

    parseTags(genres: Genre[]): SearchFilter[] {
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

        return [
            {
                id: 'chapters',
                title: 'Chapters',
                type: FilterType.SELECT,
                options: predefinedChaptersTags
            },
            {
                id: 'genres',
                title: 'Genres',
                type: FilterType.MULTISELECT,
                options: genres.map((g) => ({ id: `${g.id}`, title: g.name }))
            },
            {
                id: 'status',
                title: 'Status',
                type: FilterType.SELECT,
                options: toPreset(statusOptions)
            },
            {
                id: 'type',
                title: 'Type',
                type: FilterType.SELECT,
                options: toPreset(typeOptions)
            },
            {
                id: 'order',
                title: 'Order',
                type: FilterType.SELECT,
                options: toPreset(orderOptions)
            }
        ]
    }

    parseSearchResults(items: SeriesSearchItem[]): Highlight[] {
        return items.map((item) => ({
            id: item.slug,
            cover: item.cover,
            title: item.title,
            webUrl: item.public_url
        }))
    }

    async parseHomeSection($: CheerioStatic, section: HomeSectionData, source: any): Promise<Highlight[]> {
        const props = parseAstroIsland<{ items?: TrendingItem[]; chapters?: HomeFeedChapter[] }>(
            $, section.componentName, `parse home section "${section.section.title}"`)

        if (props.items) {
            return props.items.map((item) => ({
                id: item.slug,
                cover: item.cover_url || source.fallbackImage,
                title: item.title,
                subtitle: `Chapter ${item.chapter_count}`,
                webUrl: item.public_url
            }))
        }

        const isDetailed = section.section.style === SectionStyle.DetailedVerticalListGrouped
        const seen = new Map<string, Highlight>()

        const subtitleFromEntry = (entry: [string, string]): string => {
            const [chapterLine] = entry
            return `${chapterLine}`
        }

        for (const chapter of props.chapters ?? []) {
            const entry: [string, string] = [`Chapter ${chapter.number}`, chapter.time_ago ?? '']
            const existing = seen.get(chapter.comic_slug)

            if (!existing) {
                seen.set(chapter.comic_slug, {
                    id: chapter.comic_slug,
                    cover: chapter.comic_cover || source.fallbackImage,
                    title: chapter.comic_name,
                    webUrl: chapter.comic_public_url,
                    ...(isDetailed
                        ? { info: [entry] as any }
                        : { subtitle: subtitleFromEntry(entry) })
                })
            } else if (isDetailed) {
                (existing.info as any as [string, string][]).push(entry)
            }
        }

        return [...seen.values()]
    }

    protected getImageSrc(imageObj: Cheerio | undefined): string {
        let image: string | undefined
        const src = imageObj?.attr('src')
        const dataLazy = imageObj?.attr('data-lazy-src')
        const srcset = imageObj?.attr('srcset')
        const dataSRC = imageObj?.attr('data-src')

        if (typeof src != 'undefined' && !src?.startsWith('data')) {
            image = src
        } else if (typeof dataLazy != 'undefined' && !dataLazy?.startsWith('data')) {
            image = dataLazy
        } else if (typeof srcset != 'undefined' && !srcset?.startsWith('data')) {
            image = srcset?.split(' ')[0] ?? ''
        } else if (typeof dataSRC != 'undefined' && !dataSRC?.startsWith('data')) {
            image = dataSRC
        } else {
            image = 'https://i.imgur.com/GYUxEX8.png'
        }

        image = image?.split('?resize')[0] ?? ''

        return decodeURI(decodeHTMLEntity(image?.trim() ?? ''))
    }

    protected idCleaner(str: string): string {
        let cleanId: string | null = str
        cleanId = cleanId.replace(/\/$/, '')
        cleanId = cleanId.split('/').pop() ?? null
        // Remove randomised slug part
        cleanId = cleanId?.substring(0, cleanId?.lastIndexOf('-')) ?? null

        if (!cleanId) {
            throw new Error(`Unable to parse id for ${str}`)
        }

        return cleanId
    }

}