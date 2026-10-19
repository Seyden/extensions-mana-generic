import {
    CatalogRating,
    Chapter,
    ChapterData,
    Content,
    ContentSource,
    DeepLinkContext,
    Form,
    CoverRequestHandler,
    PageRequestHandler,
    PagedSearchResult,
    PageLink,
    PageLinkResolver,
    PageSection,
    ResolvedPageSection,
    SearchForm,
    SearchRequest,
    SortOption,
    SourceInfo,
    SourcePreferenceProvider,
    HttpClient,
    ImageRequest,
} from '@mana-app/types'
import {
    ATSUMARU_BASE_URL,
    ATSUMARU_HOST,
    ATSUMARU_ICON_URL,
    ATSUMARU_LANGUAGE,
    AtsumaruApi,
    parseAtsumaruUrl
} from './AtsumaruApi'
import { AtsumaruParser } from './AtsumaruParser'
import {
    ATSUMARU_HOME_LIMIT,
    ATSUMARU_HOME_SECTIONS,
    ATSUMARU_PAGE_SIZE,
    buildAtsumaruListRequest,
    buildAtsumaruSearchUrl,
    createAtsumaruSearchForm,
    createAtsumaruSortOptions,
    getAtsumaruHomeSection,
    allowedAtsumaruRatings
} from './AtsumaruSearch'
import {
    AtsumaruFilterProps,
    AtsumaruManga
} from './AtsumaruTypes'
import {
    loadAtsumaruPreferences
} from './AtsumaruPreferences'
import { createAtsumaruPreferenceMenu } from './AtsumaruPreferenceForm'

export class Target implements
    ContentSource,
    PageLinkResolver,
    CoverRequestHandler, PageRequestHandler,
    SourcePreferenceProvider {
    readonly info: SourceInfo = {
        id: 'Atsumaru',
        version: '1.0.3',
        name: 'Atsumaru',
        description: 'Read manga, manhwa, manhua, and comics from Atsumaru.',
        thumbnail: ATSUMARU_ICON_URL,
        rating: CatalogRating.MIXED,
        website: ATSUMARU_BASE_URL,
        supportedLanguages: [ATSUMARU_LANGUAGE],
        badges: ['Manga', 'Manhwa', 'Manhua'],
        developers: [
            {
                name: 'Seyden',
                avatarUrl: 'https://avatars.githubusercontent.com/u/639817',
                github: 'https://github.com/Seyden'
            }
        ]
    }

    readonly config = {
        owningLinks: ['atsu.moe']
    }

    private readonly api = new AtsumaruApi()
    private readonly parser = new AtsumaruParser()

    async getContent(contentId: string): Promise<Content> {
        const response = await this.api.getManga(contentId)
        return this.parser.parseContent(response.mangaPage)
    }

    async getChapters(contentId: string): Promise<Chapter[]> {
        const [details, chapterList] = await Promise.all([
            this.api.getManga(contentId),
            this.api.getChapters(contentId)
        ])
        return this.parser.parseChapters(
            chapterList.chapters ?? [],
            details.mangaPage.scanlators ?? [],
            contentId
        )
    }

    async getChapterData(
        contentId: string,
        chapterId: string
    ): Promise<ChapterData> {
        const response = await this.api.getChapter(contentId, chapterId)
        return this.parser.parseChapterData(
            response.readChapter?.pages,
            contentId,
            chapterId
        )
    }

    async search(
        request: SearchRequest<AtsumaruFilterProps>
    ): Promise<PagedSearchResult> {
        if (allowedAtsumaruRatings(request.context).length === 0) {
            return { results: [], isLastPage: true, totalResultCount: 0 }
        }
        const preferences = await loadAtsumaruPreferences()

        if (request.listId) {
            const section = getAtsumaruHomeSection(request.listId)
            if (!section) throw new Error(`Unknown Atsumaru list: ${request.listId}`)
            const listRequest = buildAtsumaruListRequest(
                request.listId,
                request.page,
                ATSUMARU_PAGE_SIZE,
                request.context,
                preferences
            )
            if (listRequest.kind === 'browse') {
                const response = await this.api.getBrowse(listRequest.url)
                const results = (response.items ?? []).map((manga) =>
                    this.parser.parseHighlight(manga, section.badge)
                )
                return {
                    results,
                    isLastPage: results.length < ATSUMARU_PAGE_SIZE
                }
            }

            return this.searchResponse(await this.api.getSearch(listRequest.url))
        }

        const response = await this.api.getSearch(
            buildAtsumaruSearchUrl(request, ATSUMARU_PAGE_SIZE, preferences)
        )
        return this.searchResponse(response)
    }

    async getSearchForm(): Promise<SearchForm> {
        return createAtsumaruSearchForm(await this.api.getFilters())
    }

    async getSortOptions(): Promise<SortOption[]> {
        return createAtsumaruSortOptions()
    }

    async getPreferenceMenu(): Promise<Form> {
        const [filters, preferences] = await Promise.all([
            this.api.getFilters(),
            loadAtsumaruPreferences()
        ])
        return createAtsumaruPreferenceMenu(filters, preferences)
    }

    async getSectionsForPage(link: PageLink): Promise<PageSection[]> {
        if (link.id !== 'home') throw new Error(`Unknown Atsumaru page: ${link.id}`)

        return ATSUMARU_HOME_SECTIONS.map((section) => ({
            id: section.id,
            title: section.title,
            style: section.style
        }))
    }

    async resolvePageSection(
        link: PageLink,
        sectionId: string
    ): Promise<ResolvedPageSection> {
        if (link.id !== 'home') throw new Error(`Unknown Atsumaru page: ${link.id}`)

        const section = getAtsumaruHomeSection(sectionId)
        if (!section) throw new Error(`Unknown Atsumaru section: ${sectionId}`)

        const context = link.context
        if (allowedAtsumaruRatings(context).length === 0) {
            return { items: [] }
        }
        const preferences = await loadAtsumaruPreferences()
        const request = buildAtsumaruListRequest(
            sectionId,
            1,
            ATSUMARU_HOME_LIMIT,
            context,
            preferences
        )
        const manga = await this.loadList(request)
        return {
            items: manga.map((item) =>
                this.parser.parseHighlight(item, section.badge)
            ),
            viewMoreLink: {
                request: {
                    page: 1,
                    listId: section.id,
                    context
                }
            }
        }
    }

    async handleURL(url: string): Promise<DeepLinkContext | null> {
        const parsed = parseAtsumaruUrl(url)
        if (!parsed || parsed.host !== ATSUMARU_HOST) return null

        const segments = parsed.pathname.split('/').filter(Boolean)
        const contentId = segments[0] === 'manga'
            ? segments[1]
            : segments[0] === 'read'
                ? segments[1]
                : undefined
        if (!contentId) return null

        const response = await this.api.getManga(contentId)
        return { content: this.parser.parseHighlight(response.mangaPage) }
    }

    private readonly imageTransport = new HttpClient().addHeaders({
        Referer: `${ATSUMARU_BASE_URL}/`,
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5'
    })

    getCoverTransport(_request: ImageRequest): HttpClient {
        return this.imageTransport
    }

    getPageTransport(_request: ImageRequest): HttpClient {
        return this.imageTransport
    }

    private async loadList(
        request: ReturnType<typeof buildAtsumaruListRequest>
    ): Promise<AtsumaruManga[]> {
        if (request.kind === 'browse') {
            return (await this.api.getBrowse(request.url)).items ?? []
        }
        return (await this.api.getSearch(request.url)).hits
            .map((hit) => hit.document)
    }

    private searchResponse(response: {
        page: number
        found: number
        hits: Array<{ document: AtsumaruManga }>
        request_params?: { per_page?: number }
    }): PagedSearchResult {
        const results = (response.hits ?? []).map((hit) =>
            this.parser.parseHighlight(hit.document)
        )
        const perPage = response.request_params?.per_page ?? ATSUMARU_PAGE_SIZE

        return {
            results,
            isLastPage: results.length === 0 || response.page * perPage >= response.found,
            totalResultCount: response.found
        }
    }
}
