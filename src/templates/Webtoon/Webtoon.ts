/* eslint-disable linebreak-style */

import {
    Chapter,
    ChapterData,
    Content,
    ContentSource,
    DirectoryConfig,
    DirectoryFilter,
    DirectoryHandler,
    SearchRequest,
    Form,
    Highlight,
    ImageRequestHandler,
    NetworkClientBuilder,
    NetworkRequest,
    PagedSearchResult,
    PageLink,
    PageLinkResolver,
    PageSection,
    Property,
    ResolvedPageSection,
    SourceInfo,
    SectionStyle,
    RunnerPreferenceProvider,
    NetworkResponse,
    UIToggle,
    UIButton,
    FilterType,
    Tag,
    Cookie,
    CatalogRating
} from '@mana-app/types'

import { WebtoonParser } from './WebtoonParser'

import { load } from 'cheerio'
import { FilterProps } from './WebtoonHelper'

export const BASE_URL_XX = 'https://www.webtoons.com'
export const MOBILE_URL_XX = 'https://m.webtoons.com'

export const WebtoonBaseInfo = {
    version: "1.0.0",
    thumbnail: 'Webtoon.png',
    rating: CatalogRating.SAFE,
}

export abstract class Webtoon implements ContentSource, PageLinkResolver, ImageRequestHandler, DirectoryHandler, RunnerPreferenceProvider {

    // dsk use webkit

    abstract info: SourceInfo

    private cookies: Cookie[] = []
    private parser: WebtoonParser

    constructor(
        private LOCALE: string,
        DATE_FORMAT: string,
        LANGUAGE: string,
        private BASE_URL: string,
        private MOBILE_URL: string,
        private HAVE_TRENDING: boolean)
    {
        this.parser = new WebtoonParser(DATE_FORMAT, LANGUAGE, BASE_URL, MOBILE_URL)
        this.cookies =
            [
                { name: 'ageGatePass', value: 'true' },
                { name: 'locale', value: this.LOCALE }
            ]
    }

    client: NetworkClient = new NetworkClientBuilder()
        .setRateLimit(15, 1)
        .setTimeout(30000)
        .addRequestInterceptor(async (request) => {
            request.headers = {
                ...(request.headers ?? {}),
                ...{
                    referer: `${this.BASE_URL}/`
                }
            }
            request.cookies = this.cookies

            return request
        })
        .build()

    async getPreferenceMenu(): Promise<Form> {
        return {
            sections: [
                {
                    children: [
                        UIToggle({
                            id: 'canvas_wanted',
                            title: 'Enable Canvas (Community)',
                            value: await this.getCanvasWanted(),
                            didChange: async (value) => {
                                return await this.setCanvasWanted(value)
                            }
                        }),
                        UIButton({
                            id: 'reset',
                            title: 'Reset to Default',
                            action: async () => {
                                await this.setCanvasWanted(false)
                            }
                        })
                    ]
                }
            ]
        }
    }

    async getCanvasWanted(): Promise<boolean> {
        return (await ObjectStore.get('canvas_wanted') as boolean) ?? false
    }
    async setCanvasWanted(value: boolean): Promise<void> {
        await ObjectStore.set('canvas_wanted', value)
    }

    async ExecRequest<T>(
        infos: { url: string, headers?: Record<string, string>, params?: Record<string, any>},
        parseMethods: (_: CheerioStatic) => T) : Promise<T>
    {
        const request: NetworkRequest = { ...infos, method: 'GET', validateStatus: s => s == 404 || s == 403 || s == 503 || (s >= 200 && s < 300)}
        const response = await this.client.request(request)
        this.checkResponseErrors(response)
        const $ = load(response.data as string)
        return parseMethods.call(this.parser, $)
    }

    checkResponseErrors(response: NetworkResponse): void {
        const status = response.status
        switch (status) {
            case 403:
            case 503:
                throw new CloudflareError(response.request.url)
            case 404:
                throw new Error(`The requested page ${response.request.url} was not found!`)
        }
    }

    async getContent(mangaId: string): Promise<Content> {
        return this.ExecRequest(
            { url: `${this.BASE_URL}/${mangaId}` },
            $ => this.parser.parseDetails($, mangaId))
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        return this.ExecRequest(
            {
                url: `${this.MOBILE_URL}/${mangaId}`,
                headers: { 'Referer': this.MOBILE_URL}
            }
            , this.parser.parseChaptersList)
    }

    async getChapterData(mangaId: string, chapterId: string, chapter?: Chapter): Promise<ChapterData> {
        return this.ExecRequest(
            { url: `${this.BASE_URL}/${chapterId}` },
            $ => this.parser.parseChapterDetails($, mangaId, chapterId))
    }

    getPopularTitles(): Promise<Highlight[]> {
        return this.ExecRequest(
            { url: `${this.BASE_URL}/popular` },
            this.parser.parsePopularTitles)
    }

    getTodayTitles(allTitles: boolean): Promise<Highlight[]> {
        return this.ExecRequest(
            { url: `${this.BASE_URL}/dailySchedule` },
            $ => this.parser.parseTodayTitles($, allTitles))
    }

    getOngoingTitles(allTitles: boolean): Promise<Highlight[]> {
        return this.ExecRequest(
            { url: `${this.BASE_URL}/dailySchedule` },
            $ => this.parser.parseOngoingTitles($, allTitles))
    }

    getCompletedTitles(allTitles: boolean): Promise<Highlight[]> {
        return this.ExecRequest(
            { url: `${this.BASE_URL}/dailySchedule` },
            $ => this.parser.parseCompletedTitles($, allTitles))
    }

    getCanvasRecommendedTitles(): Promise<Highlight[]> {
        return this.ExecRequest(
            { url: `${this.BASE_URL}/canvas` },
            this.parser.parseCanvasRecommendedTitles)
    }

    getCanvasPopularTitles(request?: SearchRequest<FilterProps>, genre?: string): Promise<Highlight[]> {
        return this.ExecRequest(
            {
                url: `${this.BASE_URL}/canvas/list`,
                params: { genreTab: genre ?? 'ALL', sortOrder: 'READ_COUNT', page: request?.page ?? 1}
            },
            this.parser.parseCanvasPopularTitles)
    }

    async getFilters(): Promise<DirectoryFilter[]> {
        const result: DirectoryFilter[] =
            [
                {
                    id: 'genres',
                    title: 'Genres',
                    type: FilterType.SELECT,
                    options: await this.ExecRequest({ url: `${this.BASE_URL}/genres` }, $ => this.parser.parseGenres($).map((tag: Tag) => ({ id: tag.id, title: tag.title })))
                }
            ]

        if (await this.getCanvasWanted())
            result.push(
                {
                    id: 'canvasgenres',
                    title: 'Canvas Genres',
                    type: FilterType.SELECT,
                    options: await this.ExecRequest({ url: `${this.BASE_URL}/canvas` }, $ => this.parser.parseCanvasGenres($).map((tag: Tag) => ({ id: tag.id, title: tag.title })))
                }
            )

        return result
    }

    async getTags(): Promise<Property[]> {
        const filters = await this.getFilters()
        return [
            {
                id: "genres",
                title: "Genres",
                tags: filters.find(x => x.id == "genres")?.options!
            },
            {
                id: "canvasgenres",
                title: "Canvas Genres",
                tags: filters.find(x => x.id == "canvasgenres")?.options!
            }
        ]
    }

    async getDirectory(searchRequest: SearchRequest<FilterProps>): Promise<PagedSearchResult> {
        if (searchRequest.listId) {
            return this.getViewMoreItems(searchRequest)
        }

        if (searchRequest?.filters?.genres || searchRequest?.filters?.canvasgenres)
        {
            if (searchRequest?.filters?.canvasgenres)
            {
                const result = await this.getCanvasPopularTitles(searchRequest, searchRequest?.filters?.canvasgenres)
                return {
                    results: result,
                    isLastPage: false
                }
            }
            else
            {
                return await this.ExecRequest(
                    {
                        url: `${this.BASE_URL}/genres/${searchRequest?.filters?.genres}`,
                        params: { sortOrder: 'READ_COUNT#'}
                    },
                    $ => this.parser.parseTagResults($))

            }
        }
        else
        {
            if (!searchRequest.query) {
                return {
                    results: [],
                    isLastPage: true
                }
            }

            const params = { keyword: searchRequest.query } as Record<string, unknown>
            const canvas_wanted = await this.getCanvasWanted()
            if (!canvas_wanted)
                params['searchType'] = 'WEBTOON'

            return await this.ExecRequest(
                {
                    url: `${this.BASE_URL}/search`,
                    params: params
                },
                $ => this.parser.parseSearchResults($, canvas_wanted))
        }
    }

    async getDirectoryConfig(configID?: string | undefined): Promise<DirectoryConfig> {
        if (configID) {
            return { searchable: false }
        }

        return {
            filters: await this.getFilters(),
        }
    }

    async getSectionsForPage(link: PageLink): Promise<PageSection[]> {
        if (link.id !== "home") {
            throw new Error("Accessing invalid page")
        }

        const sections : {request: Promise<Highlight[]>, section: PageSection}[] = []
        if(this.HAVE_TRENDING)
            sections.push(
                {
                    request: this.getPopularTitles(),
                    section: {
                        id: 'popular',
                        title: 'New & Trending',
                        style: SectionStyle.SimpleSingleRow
                    }
                })

        sections.push(...[
            {
                request: this.getTodayTitles(false),
                section: {
                    id: 'today',
                    title: 'Today release',
                    viewMoreLink: { request: { page: 0, listId: "today" } },
                    style: SectionStyle.SimpleSingleRow
                }
            },
            {
                request: this.getOngoingTitles(false),
                section: {
                    id: 'ongoing',
                    title: 'Ongoing',
                    viewMoreLink: { request: { page: 0, listId: "ongoing" } },
                    style: SectionStyle.SimpleSingleRow
                }
            },
            {
                request: this.getCompletedTitles(false),
                section: {
                    id: 'completed',
                    title: 'Completed',
                    viewMoreLink: { request: { page: 0, listId: "completed" } },
                    style: SectionStyle.SimpleSingleRow
                }
            }
        ])

        if (await this.getCanvasWanted())
        {
            sections.push(
                ...[
                    {
                        request: this.getCanvasRecommendedTitles(),
                        section: {
                            id: 'canvas_recommended',
                            title: 'Canvas Recommended',
                            style: SectionStyle.SimpleSingleRow
                        }
                    },
                    {
                        request: this.getCanvasPopularTitles({page : 1}),
                        section: {
                            id: 'canvas_popular',
                            title: 'Canvas Popular',
                            viewMoreLink: { request: { page: 0, listId: "canvas_popular" } },
                            style: SectionStyle.SimpleSingleRow
                        }

                    }
                ]
            )
        }

        const promises: Promise<PageSection>[] = []

        for (const section of sections) {
            promises.push(section.request
                                 .then(items => {
                                     section.section.items = items
                                     return section.section
                                 }))
        }

        // Make sure the function completes
        return await Promise.all(promises)
    }

    async getViewMoreItems(request: SearchRequest<FilterProps>): Promise<PagedSearchResult> {
        let items: Highlight[] = []

        switch (request.listId) {
            case 'today':
                items = await this.getTodayTitles(true)
                break

            case 'ongoing':
                items = await this.getOngoingTitles(true)
                break

            case 'completed':
                items = await this.getCompletedTitles(true)
                break

            case 'canvas_popular':
                request.page += 1
                items = await this.getCanvasPopularTitles(request)
                break

            default:
                throw new Error(`Invalid homeSectionId | ${request.listId}`)
        }

        return {
            results: items,
            isLastPage: false
        }
    }

    async willRequestImage(url: string): Promise<NetworkRequest> {
        return {
            url,
            headers: {
                'referer': `${BASE_URL_XX}/`,
                'Accept': 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
                'Accept-Encoding' : 'gzip, deflate, br, zstd'
                //'origin': `${baseUrl}/`,
            }
        }
    }

    resolvePageSection(link: PageLink, sectionID: string): Promise<ResolvedPageSection> {
        throw new Error('Method not needed.')
    }
}