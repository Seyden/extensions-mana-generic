import {
    CatalogRating,
    Chapter,
    ChapterData,
    Content,
    ContentSource,
    Form,
    ImageRequestHandler,
    NetworkRequest,
    PagedSearchResult,
    PageLink,
    PageLinkResolver,
    PageSection,
    ResolvedPageSection,
    SearchForm,
    SearchFormSubmission,
    SearchFormValidationResult,
    SearchRequest,
    SortOption,
    SourceContext,
    SourceContextOrigin,
    SourceInfo,
    SourcePreferenceProvider
} from '@mana-app/types'
import { MangaDotApi } from './MangaDotApi'
import {
    decodeChapterReference,
    MangaDotParser,
    parseScanlatorPriority
} from './MangaDotParser'
import {
    buildMangaDotSearchTarget,
    createMangaDotPreferenceMenu,
    createMangaDotSearchForm,
    createMangaDotSortOptions,
    allowedMangaDotRatings,
    DEFAULT_MANGADOT_BROWSE_PREFERENCES,
    filterMangaDotPageByContext,
    hasBrowsePreferences,
    HOME_SECTIONS,
    loadMangaDotBrowsePreferences,
    loadMangaDotChapterPreferences,
    loadMangaDotDetailsPreferences,
    loadMangaDotPreferences,
    searchOptions
} from './MangaDotSearch'
import {
    MANGADOT_DOMAIN,
    MANGADOT_LANGUAGE,
    MANGADOT_PAGE_SIZE,
    MangaDotBrowsePreferences,
    MangaDotFilterProps
} from './MangaDotTypes'

export class Target implements
    ContentSource,
    PageLinkResolver,
    ImageRequestHandler,
    SourcePreferenceProvider {
    readonly info: SourceInfo = {
        id: 'MangaDot',
        version: '1.0.1',
        name: 'MangaDot',
        description: 'Read manga, manhwa, and manhua from MangaDot.',
        thumbnail: 'MangaDot.png',
        rating: CatalogRating.MIXED,
        website: MANGADOT_DOMAIN,
        supportedLanguages: [MANGADOT_LANGUAGE],
        badges: ['Manga', 'Manhwa', 'Manhua'],
        developers: [{
            name: 'Seyden',
            avatarUrl: 'https://avatars.githubusercontent.com/u/639817',
            github: 'https://github.com/Seyden'
        }]
    }

    readonly config = {
        cloudflareResolutionURL: MANGADOT_DOMAIN
    }

    private readonly api = new MangaDotApi()
    private readonly parser = new MangaDotParser()

    async getContent(contentId: string, context?: SourceContext): Promise<Content> {
        const isMigration = context?.origin === SourceContextOrigin.MIGRATION
        const [details, suggestions, relations, preferences] = await Promise.all([
            this.api.getDetails(contentId),
            isMigration ? Promise.resolve({}) : this.api.getSuggestions(contentId),
            isMigration ? Promise.resolve({}) : this.api.getRelations(contentId),
            loadMangaDotDetailsPreferences()
        ])
        return this.parser.parseContent(
            details.manga,
            suggestions,
            relations,
            preferences.showDetailedTags
        )
    }

    async getChapters(contentId: string): Promise<Chapter[]> {
        const preferences = await loadMangaDotChapterPreferences()
        const priorities = parseScanlatorPriority(preferences.preferredScanlators)
        if (preferences.chapterMode === 'chapters') {
            return this.parser.parseChapters(
                await this.api.getChapters(contentId),
                [],
                'chapters',
                priorities
            )
        }
        if (preferences.chapterMode === 'volumes') {
            const volumes = await this.api.getVolumes(contentId)
            const chapters = volumes.length === 0 ? await this.api.getChapters(contentId) : []
            return this.parser.parseChapters(chapters, volumes, 'volumes', priorities)
        }

        const [chapters, volumes] = await Promise.all([
            this.api.getChapters(contentId),
            this.api.getVolumes(contentId)
        ])
        return this.parser.parseChapters(chapters, volumes, 'both', priorities)
    }

    async getChapterData(contentId: string, chapterId: string): Promise<ChapterData> {
        const reference = decodeChapterReference(chapterId)
        const response = await this.api.getImages(reference.source, reference.id)
        return this.parser.parseChapterData(response, contentId, chapterId)
    }

    async search(request: SearchRequest<MangaDotFilterProps>): Promise<PagedSearchResult> {
        const ignoresSourceFilters = request.filters != null &&
            Object.keys(request.filters).length === 0
        const preferences = ignoresSourceFilters
            ? DEFAULT_MANGADOT_BROWSE_PREFERENCES
            : await loadMangaDotBrowsePreferences()
        return this.searchWithPreferences(request, preferences)
    }

    async getSearchForm(): Promise<SearchForm> {
        const [facets, tags] = await Promise.all([
            this.api.getFacets(),
            this.api.getTags().catch(() => undefined)
        ])
        return createMangaDotSearchForm(searchOptions(facets, tags))
    }

    async getSortOptions(): Promise<SortOption[]> {
        return createMangaDotSortOptions()
    }

    async validateSearchForm(
        form: SearchFormSubmission<MangaDotFilterProps>
    ): Promise<SearchFormValidationResult> {
        const yearFrom = form.filters?.yearFrom ?? 0
        const yearTo = form.filters?.yearTo ?? 0
        if (yearFrom > 0 && yearTo > 0 && yearFrom > yearTo) {
            return {
                valid: false,
                message: 'The starting year must not be later than the ending year.',
                fieldErrors: {
                    yearFrom: 'Must be earlier than or equal to the ending year.',
                    yearTo: 'Must be later than or equal to the starting year.'
                }
            }
        }
        return { valid: true }
    }

    async getPreferenceMenu(): Promise<Form> {
        const [preferences, facets] = await Promise.all([
            loadMangaDotPreferences(),
            this.api.getFacets().catch(() => undefined)
        ])
        const genres = facets?.genres?.map((bucket) => bucket.key) ?? []
        return createMangaDotPreferenceMenu(genres, preferences)
    }

    async getSectionsForPage(link: PageLink): Promise<PageSection[]> {
        if (link.id !== 'home') throw new Error(`Unknown MangaDot page: ${link.id}`)

        const preferences = await loadMangaDotBrowsePreferences()
        return Promise.all(HOME_SECTIONS.map(async (section) => {
            const page = await this.searchWithPreferences({
                page: 1,
                listId: section.id,
                context: link.context
            }, preferences)
            return {
                id: section.id,
                title: section.title,
                style: section.style,
                items: page.results.slice(0, 14),
                viewMoreLink: {
                    request: {
                        page: 1,
                        listId: section.id,
                        context: link.context
                    }
                }
            }
        }))
    }

    async resolvePageSection(
        _link: PageLink,
        _sectionID: string
    ): Promise<ResolvedPageSection> {
        throw new Error('MangaDot page sections are returned fully resolved')
    }

    async willRequestImage(imageURL: string): Promise<NetworkRequest> {
        try {
            const host = new URL(imageURL).hostname
            const mangaDotHost = new URL(MANGADOT_DOMAIN).hostname
            if (host === mangaDotHost || host.endsWith(`.${mangaDotHost}`)) {
                return {
                    url: imageURL,
                    headers: {
                        Referer: `${MANGADOT_DOMAIN}/`,
                        Origin: MANGADOT_DOMAIN
                    }
                }
            }
        } catch {
            // Let the app surface malformed external image URLs normally.
        }
        return { url: imageURL }
    }

    private async searchWithPreferences(
        request: SearchRequest<MangaDotFilterProps>,
        preferences: MangaDotBrowsePreferences
    ): Promise<PagedSearchResult> {
        const allowedRatings = allowedMangaDotRatings(request.context)
        if (allowedRatings.length === 0) {
            return { results: [], isLastPage: true, totalResultCount: 0 }
        }

        const section = request.listId
            ? HOME_SECTIONS.find((item) => item.id === request.listId)
            : undefined
        if (request.listId && !section) {
            throw new Error(`Unknown MangaDot section: ${request.listId}`)
        }

        if (section &&
            !hasBrowsePreferences(preferences) &&
            allowedRatings.length === 4) {
            const response = await this.api.getSection(
                section.id,
                Math.max(1, request.page || 1),
                MANGADOT_PAGE_SIZE
            )
            return filterMangaDotPageByContext(
                this.parser.parsePagedResults(
                    response,
                    Math.max(1, request.page || 1),
                    MANGADOT_PAGE_SIZE
                ),
                request.context
            )
        }

        const target = buildMangaDotSearchTarget(request, preferences, section?.id)
        if (target.impossible || !target.url) {
            return { results: [], isLastPage: true, totalResultCount: 0 }
        }
        const response = await this.api.getSearch(target.url)
        return filterMangaDotPageByContext(
            this.parser.parsePagedResults(
                response,
                Math.max(1, request.page || 1),
                MANGADOT_PAGE_SIZE
            ),
            request.context
        )
    }
}
