import {
    Chapter,
    ChapterData,
    Content,
    ContentSource,
    ImageRequestHandler,
    NetworkClientBuilder,
    NetworkRequest,
    NetworkResponse,
    Option,
    PagedSearchResult,
    PageLink,
    PageLinkResolver,
    PageSection,
    ResolvedPageSection,
    SearchDatePicker,
    SearchExcludableMultiPickerSheet,
    SearchForm,
    SearchListSection,
    SearchMultiPicker,
    SearchMenuPicker,
    SearchRequest,
    SearchSortSection,
    SearchStepper,
    SectionStyle,
    SortOption,
    SourceInfo
} from '@mana-app/types'
import {
    IkenChapterResponse,
    IkenChaptersResponse,
    IkenFilterProps,
    IkenGenre,
    IkenHomeSection,
    IkenPostResponse,
    IkenQueryValue,
    IkenSearchResponse
} from './IkenInterfaces'
import { IkenParser } from './IkenParser'

const BASE_VERSION = '1.0.0'

export function getExportVersion(extensionVersion: string): string {
    return BASE_VERSION
        .split('.')
        .map((value, index) => Number(value) + Number(extensionVersion.split('.')[index] ?? 0))
        .join('.')
}

export function buildIkenApiUrl(
    apiUrl: string,
    path: string,
    parameters: Record<string, IkenQueryValue> = {}
): string {
    const query = Object.entries(parameters)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&')

    const url = `${apiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
    return query ? `${url}?${query}` : url
}

export function buildIkenSearchParameters(
    request: SearchRequest<IkenFilterProps>,
    perPage: number,
    homeSection?: IkenHomeSection
): Record<string, IkenQueryValue> {
    return {
        page: request.page ?? 1,
        perPage,
        searchTerm: request.query?.trim() ?? '',
        genreIds: request.filters?.genres?.included?.map((genre) => genre.id).join(',') || undefined,
        excludedGenreIds: request.filters?.genres?.excluded?.map((genre) => genre.id).join(',') || undefined,
        seriesType: request.filters?.types?.map((type) => type.id).join(',') || undefined,
        seriesStatus: request.filters?.status?.id,
        minChapters: (request.filters?.minimumChapters ?? 0) > 0
            ? request.filters?.minimumChapters
            : undefined,
        maxChapters: (request.filters?.maximumChapters ?? 0) > 0
            ? request.filters?.maximumChapters
            : undefined,
        createdAfter: request.filters?.createdAfter || undefined,
        createdBefore: request.filters?.createdBefore || undefined,
        orderBy: homeSection?.orderBy ?? request.sort?.id ?? 'lastChapterAddedAt',
        orderDirection: homeSection ? 'desc' : request.sort?.ascending ? 'asc' : 'desc'
    }
}

export abstract class Iken implements ContentSource, PageLinkResolver, ImageRequestHandler {
    abstract info: SourceInfo
    abstract baseUrl: string

    language = 'en_GB'
    perPage = 20
    sortPagesByFilename = false
    fallbackImage = 'https://i.imgur.com/GYUxEX8.png'

    protected parser = new IkenParser()

    protected statusOptions: Option[] = [
        { id: 'ONGOING', title: 'Ongoing' },
        { id: 'COMPLETED', title: 'Completed' },
        { id: 'HIATUS', title: 'Hiatus' },
        { id: 'DROPPED', title: 'Dropped' }
    ]

    protected typeOptions: Option[] = [
        { id: 'MANGA', title: 'Manga' },
        { id: 'MANHUA', title: 'Manhua' },
        { id: 'MANHWA', title: 'Manhwa' }
    ]

    protected sortOptions: SortOption[] = [
        { id: 'lastChapterAddedAt', title: 'Latest Chapters', isDefault: true, isOrderable: true },
        { id: 'updatedAt', title: 'Recently Updated', isOrderable: true },
        { id: 'totalViews', title: 'Popular', isOrderable: true },
        { id: 'createdAt', title: 'Added Date', isOrderable: true },
        { id: 'chaptersCount', title: 'Most Chapters', isOrderable: true },
        { id: 'postTitle', title: 'Alphabetical', isOrderable: true }
    ]

    protected homeSections: IkenHomeSection[] = [
        {
            id: 'popular_today',
            title: 'Popular Today',
            orderBy: 'totalViews',
            style: SectionStyle.SimpleHeroPaged,
            containsMoreItems: false
        },
        {
            id: 'latest_releases',
            title: 'Latest Releases',
            orderBy: 'lastChapterAddedAt',
            style: SectionStyle.DetailedVerticalListGrouped,
            containsMoreItems: true
        }
    ]

    client: NetworkClient = new NetworkClientBuilder()
        .setRateLimit(10, 1)
        .setTimeout(30000)
        .addRequestInterceptor(async (request) => ({
            ...request,
            headers: {
                ...(request.headers ?? {}),
                referer: `${this.baseUrl}/`,
                origin: this.baseUrl
            }
        }))
        .build()

    get apiUrl(): string {
        return this.baseUrl.replace(/^(https?:\/\/)(?:www\.)?/, '$1api.')
    }

    async getContent(contentId: string): Promise<Content> {
        const response = await this.getJson<IkenPostResponse>('api/post', {
            postId: contentId
        })

        if (!response.post || response.post.id.toString() !== contentId) {
            throw new Error(`Invalid post response for content ${contentId}`)
        }

        return this.parser.parseContent(response.post, this.fallbackImage)
    }

    async getChapters(contentId: string): Promise<Chapter[]> {
        const response = await this.getJson<IkenChaptersResponse>('api/chapters', {
            postId: contentId
        })
        const chapters = response.post?.chapters

        if (!Array.isArray(chapters)) {
            throw new Error(`Invalid chapter response for content ${contentId}`)
        }

        return this.parser.parseChapters(chapters, this.language)
    }

    async getChapterData(_contentId: string, chapterId: string): Promise<ChapterData> {
        const response = await this.getJson<IkenChapterResponse>('api/chapter', {
            chapterId
        })

        if (!response.chapter) {
            throw new Error(`Invalid page response for chapter ${chapterId}`)
        }

        return this.parser.parseChapterData(response.chapter, this.sortPagesByFilename)
    }

    async getSearchForm(): Promise<SearchForm> {
        const genres = await this.getJson<IkenGenre[]>('api/genres')

        if (!Array.isArray(genres)) {
            throw new Error('Invalid genres response')
        }

        return {
            sections: [
                SearchListSection({
                    children: [SearchExcludableMultiPickerSheet({
                        id: 'genres',
                        title: 'Genres',
                        options: genres.map((genre) => ({
                            id: genre.id.toString(),
                            title: genre.name
                        }))
                    })]
                }),
                SearchListSection({
                    header: 'Filters',
                    children: [
                        SearchMultiPicker({
                            id: 'types',
                            title: 'Type',
                            options: this.typeOptions
                        }),
                        SearchMenuPicker({
                            id: 'status',
                            title: 'Status',
                            options: this.statusOptions
                        })
                    ]
                }),
                SearchListSection({
                    header: 'Chapter Count',
                    children: [
                        SearchStepper({
                            id: 'minimumChapters',
                            title: 'Minimum chapters',
                            lowerBound: 0,
                            step: 1
                        }),
                        SearchStepper({
                            id: 'maximumChapters',
                            title: 'Maximum chapters',
                            lowerBound: 0,
                            step: 1
                        })
                    ]
                }),
                SearchListSection({
                    header: 'Release Date',
                    children: [
                        SearchDatePicker({
                            id: 'createdAfter',
                            title: 'Created after'
                        }),
                        SearchDatePicker({
                            id: 'createdBefore',
                            title: 'Created before'
                        })
                    ]
                }),
                SearchSortSection({ header: 'Sort' })
            ]
        }
    }

    async getSortOptions(): Promise<SortOption[]> {
        return this.sortOptions
    }

    async search(request: SearchRequest<IkenFilterProps>): Promise<PagedSearchResult> {
        const homeSection = request.listId
            ? this.homeSections.find((section) => section.id === request.listId)
            : undefined

        if (request.listId && !homeSection) {
            throw new Error(`Invalid home section: ${request.listId}`)
        }

        const parameters = buildIkenSearchParameters(request, this.perPage, homeSection)
        const response = await this.getJson<IkenSearchResponse>('api/query', parameters)

        if (!Array.isArray(response.posts) || typeof response.totalCount !== 'number') {
            throw new Error('Invalid search response')
        }

        const results = this.parser.parseHighlights(
            response.posts,
            this.fallbackImage,
            homeSection?.style
        )

        return {
            results,
            isLastPage: (request.page ?? 1) * this.perPage >= response.totalCount,
            totalResultCount: response.totalCount
        }
    }

    async getSectionsForPage(link: PageLink): Promise<PageSection[]> {
        if (link.id !== 'home') {
            throw new Error(`Invalid page: ${link.id}`)
        }

        return Promise.all(this.homeSections.map(async (section) => {
            const result = await this.search({
                page: 1,
                listId: section.id
            })

            return {
                id: section.id,
                title: section.title,
                style: section.style,
                items: result.results,
                viewMoreLink: section.containsMoreItems
                    ? {
                        request: {
                            page: 1,
                            listId: section.id
                        }
                    }
                    : undefined
            }
        }))
    }

    async willRequestImage(url: string): Promise<NetworkRequest> {
        return {
            url,
            headers: {
                referer: `${this.baseUrl}/`,
                origin: this.baseUrl,
                Accept: 'image/avif,image/webp,image/png,image/*;q=0.8,*/*;q=0.5'
            }
        }
    }

    async resolvePageSection(_link: PageLink, _sectionId: string): Promise<ResolvedPageSection> {
        throw new Error('All Iken page sections are resolved eagerly')
    }

    protected async getJson<T>(path: string, parameters: Record<string, IkenQueryValue> = {}): Promise<T> {
        const url = buildIkenApiUrl(this.apiUrl, path, parameters)
        const response = await this.client.request({
            url,
            method: 'GET',
            validateStatus: (status) => status === 403
                || status === 404
                || status === 503
                || (status >= 200 && status < 300)
        })

        this.checkResponse(response)

        try {
            return (typeof response.data === 'string'
                ? JSON.parse(response.data)
                : response.data) as T
        } catch {
            throw new Error(`Invalid JSON response from ${url}`)
        }
    }

    private checkResponse(response: NetworkResponse): void {
        switch (response.status) {
            case 403:
            case 503:
                throw new CloudflareError(this.baseUrl)
            case 404:
                throw new Error(`The requested page ${response.request.url} was not found`)
            default:
                if (response.status < 200 || response.status >= 300) {
                    throw new Error(`Request failed with status ${response.status}`)
                }
        }
    }
}
