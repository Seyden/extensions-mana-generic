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
    Property,
    PublicationStatus,
    DirectoryFilter
} from '@suwatte/daisuke'

import {
    HomeSectionData,
    setMangaSlug
} from './AsuraScansHelper'

import { decode as decodeHTMLEntity } from 'html-entities'
import { NextJSParser } from './NextJSParser'
import { load } from 'cheerio'

export class AsuraScansParser{
    async parseMangaDetails(data: string, mangaId: string, source: any): Promise<Content> {
        const $ = load(data, { _useHtmlParser2: true })
        const nextJSParser = new NextJSParser($, ["chapters"])

        const comicKey = nextJSParser.getReferenceKeyForProperty('comic')
        if (!comicKey) {
            throw new Error(`Failed to retrieve the comic key for manga ${mangaId}`)
        }

        const comic = nextJSParser.getObjectByKey(comicKey)

        const title = comic.name.trim()
        const author = comic.author?.trim()
        const artist = comic.artist?.trim()

        const image = comic.thumb
        const covers = [comic.cover]
        let description = comic.summary.trim()
        if (description != '') {
            description = decodeHTMLEntity(load(description).root().text().replace(/\\r\\n/gm, '\n'))
        }

        let slug = comic.slug?.trim()
        if (slug)  {
            slug = `${source.sourceTraversalPathName}/${slug}`
            await setMangaSlug(mangaId, slug)
        }

        const rawStatus = comic.status?.name?.trim() ?? ''
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

        const properties: Property[] = [
            {
                id: "genres",
                title: "Genres",
                tags: comic.genres.map((genre: any) => ({
                    id: genre.id.toString(),
                    title: genre.name
                }))
            },
            ... author || artist ? [{
                id: "creators",
                title: "Credits",
                tags: [
                    ... author ? [{
                        title: author,
                        id: `author-${author}`,
                        noninteractive: true
                    }] : [],
                    ... artist ? [{
                        title: artist,
                        id: `artist-${artist}`,
                        noninteractive: true
                    }] : [],
                ],
            }] : []
        ]

        const chapters = await this.parseChapterList(nextJSParser, mangaId, source, slug)

        return {
            title: title,
            status,
            properties,
            summary: description,
            cover: image || source.fallbackImage,
            additionalCovers: covers,
            ...(chapters.length > 0 && { chapters }),
            contentType: ContentType.MANHWA
        }
    }

    async parseChapterList(nextJSParser: NextJSParser, mangaId: string, source: any, mangaSlug: string): Promise<Chapter[]> {
        const chapterKey = nextJSParser.getKeyForProperty('chapters')
        if (!chapterKey) {
            throw new Error(`Failed to retrieve the chapter key for manga ${mangaId}`)
        }

        const chapters: Chapter[] = []
        let sortingIndex = 0

        const rawChapters = nextJSParser.getObjectByKey(chapterKey)
        for (const chapter of rawChapters[3].chapters.reverse()) {
            if (chapter.is_early_access) {
                continue
            }
            const title = chapter.title
            const name = chapter.name
            const publishedDate = chapter.published_at
            const link = `${mangaSlug}/chapter/${name}`

            chapters.push({
                chapterId: name.toString(),
                language: source.language,
                number: name,
                title: !title ? `Chapter ${name}` : title,
                date: new Date(publishedDate),
                index: sortingIndex,
                volume: 0,
                webUrl: link
            })
            sortingIndex++
        }

        return chapters
    }

    parseChapterDetails(data: string, mangaId: string): ChapterData {
        const $ = load(data, { _useHtmlParser2: true })

        let scriptContent = $('script:contains("self.__next_f.push")').toArray().map(x => {
            let content = $(x).html() ?? ''
            return content.substring(content.indexOf('"') + 1, content.lastIndexOf('"'))
        }).join('')
        scriptContent = scriptContent.replace(/\\"/gm, '"') ?? ''
        const match = scriptContent.match(/"pages":(\[.*?])/m)

        const pagesObj = match?.[1]
        if (!pagesObj) {
            throw new Error(`Failed to parse chapter pages for manga ${mangaId}`)
        }

        const pages: ChapterPage[] = JSON.parse(pagesObj)
                                         .map((page: any) => ({
                                             url: page.url,
                                             order: page.order
                                         }))
                                         .sort((x: any) => x.order)
                                         .map((x: ChapterPage) => ({ url: x.url }))

        return {
            pages: pages
        }
    }

    parseTags(data: string): DirectoryFilter[] {
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

        const filters = JSON.parse(data)

        const createTags = (filterItems: any): Option[] => {
            return filterItems.map((item: { id: any; value: any; name: any }) => ({
                id: `${item.id ?? item.value}`, // Use `id` or `value` for `order` items
                title: item.name
            }))
        }

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
                options: createTags(filters.genres)
            },
            {
                id: 'status',
                title: 'Status',
                type: FilterType.SELECT,
                options: createTags(filters.statuses)
            },
            {
                id: 'type',
                title: 'Type',
                type: FilterType.SELECT,
                options: createTags(filters.types)
            },
            {
                id: 'order',
                title: 'Order',
                type: FilterType.SELECT,
                options: createTags(filters.order)
            }
        ]
    }

    async parseSearchResults($: CheerioSelector, source: any): Promise<any[]> {
        const results: any[] = []

        const mangas = $('a', $('h3:contains(Series list)')?.parent()?.next()?.next())
        if (!mangas.length) {
            console.log(`Unable to parse search results!`)
            return results
        }

        for (const manga of mangas.toArray()) {
            const slug = $(manga).attr('href') ?? ''
            if (!slug) {
                throw new Error(`Unable to parse slug (${slug})!`)
            }

            const image = this.getImageSrc($('img', manga))
            const title: string = $('span.block', manga).text().trim()
            const subtitle = $('span.block', manga)?.next()?.text().trim() ?? ''
            const mangaId: string = this.idCleaner(slug ?? '')

            await setMangaSlug(mangaId, slug)

            results.push({
                mangaId,
                image: image || source.fallbackImage,
                title: decodeHTMLEntity(title),
                subtitle: decodeHTMLEntity(subtitle)
            })
        }

        return results
    }

    async parseHomeSection($: CheerioStatic, section: HomeSectionData, source: any): Promise<Highlight[]> {
        const items: Highlight[] = []
        const baseUrl = await source.getBaseUrl()

        const mangas = section.selectorFunc($)
        if (!mangas.length) {
            console.log(`Unable to parse valid ${section.section.title} section!`)
            return items
        }

        for (const manga of mangas.toArray()) {
            const title = section.titleSelectorFunc($, manga)
            if (!title) {
                console.log(`Failed to parse homepage sections for ${baseUrl} title (${title})`)
                continue
            }

            const image = this.getImageSrc($('img', manga))
            const subtitleResult = section.subtitleSelectorFunc($, manga)
            const subtitle = Array.isArray(subtitleResult) ? '' : decodeHTMLEntity(subtitleResult) ?? ''
            const href = $('a', manga).attr('href') ?? ''
            const mangaId: string = this.idCleaner(href ?? '')

            if (!mangaId) {
                console.log(`Failed to parse homepage sections for ${baseUrl} title (${title}) mangaId (${mangaId})`)
                continue
            }

            await setMangaSlug(mangaId, href)

            items.push({
                id: mangaId,
                cover: image || source.fallbackImage,
                title: decodeHTMLEntity(title),
                info: Array.isArray(subtitleResult) ? subtitleResult  : [subtitle],
                webUrl: href
            })
        }

        return items
    }

    isLastPage = ($: CheerioStatic): boolean => {
        let isLast = true
        const obj = $('a:contains(Next)')
        const hasNext = obj.attr('style')?.includes('pointer-events:auto') ?? false
        if (hasNext) {
            isLast = false
        }

        return isLast
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