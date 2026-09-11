import {
    Chapter,
    ChapterData,
    Content,
    ContentSource,
    Form,
    ImageRequestHandler,
    PagedSearchResult,
    PageLink,
    PageLinkResolver,
    PageSection,
    ResolvedPageSection,
    SearchForm,
    SearchFormSubmission,
    SearchFormValidationResult,
    SearchRequest,
    SectionStyle,
    SortOption,
    SourceInfo,
    SourcePreferenceProvider
} from '@mana-app/types'
import {
    ComixFilterProps,
    ComixManga
} from './ComixInterfaces'
import { COMIX_SOURCE_INFO } from './ComixInfo'
import { ComixParser } from './ComixParser'
import {
    buildComixHomeSectionParams,
    buildComixSearchLookups,
    buildComixSearchParams,
    createComixSearchForm,
    createComixSortOptions
} from './ComixSearch'
import { ComixWebViewClient } from './reader/ComixWebView'
import { ComixHttpClient } from './ComixHttp'
import {
    buildComixPreferenceParams,
    loadComixPreferences
} from './ComixPreferences'
import { createComixPreferenceMenu } from './ComixPreferenceForm'
import { createComixImageRequest } from './ComixImageRequest'

export class Target implements
    ContentSource,
    PageLinkResolver,
    ImageRequestHandler,
    SourcePreferenceProvider {
    readonly info: SourceInfo = COMIX_SOURCE_INFO

    private readonly parser = new ComixParser()
    private readonly webView = new ComixWebViewClient()
    private readonly http = new ComixHttpClient()

    async getContent(contentId: string): Promise<Content> {
        const [manga, preferences] = await Promise.all([
            this.http.getManga(contentId),
            loadComixPreferences()
        ])
        return this.parser.parseContent(manga, preferences)
    }

    async getChapters(contentId: string): Promise<Chapter[]> {
        const [response, preferences] = await Promise.all([
            this.webView.getChapters(contentId),
            loadComixPreferences()
        ])
        return this.parser.parseChapters(response.items ?? [], contentId, preferences)
    }

    async getChapterData(
        contentId: string,
        chapterId: string,
        chapter?: Chapter
    ): Promise<ChapterData> {
        const pages = await this.webView.getChapterPages(
            contentId,
            chapterId,
            chapter?.webUrl
        )
        return this.parser.parseChapterData(pages, contentId, chapterId)
    }

    async search(request: SearchRequest<ComixFilterProps>): Promise<PagedSearchResult> {
        const preferences = await loadComixPreferences()
        const params = request.listId
            ? buildComixHomeSectionParams(request.listId, request.page, preferences)
            : buildComixSearchParams(request, preferences)
        const lookups = request.listId
            ? {}
            : buildComixSearchLookups(request.filters)
        const response = await this.webView.list(params, lookups)
        return this.parser.parsePagedResults(response, preferences)
    }

    async getSearchForm(): Promise<SearchForm> {
        const options = await this.http.getBrowseOptions()
        return createComixSearchForm(options)
    }

    async getSortOptions(): Promise<SortOption[]> {
        const options = await this.http.getBrowseOptions()
        return createComixSortOptions(options)
    }

    async validateSearchForm(
        form: SearchFormSubmission<ComixFilterProps>
    ): Promise<SearchFormValidationResult> {
        const filters = form.filters
        if (
            (filters?.yearFrom ?? 0) > 0 &&
            (filters?.yearTo ?? 0) > 0 &&
            (filters?.yearFrom ?? 0) > (filters?.yearTo ?? 0)
        ) {
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
        const [options, preferences] = await Promise.all([
            this.http.getBrowseOptions(),
            loadComixPreferences()
        ])
        return createComixPreferenceMenu(options, preferences)
    }

    async getSectionsForPage(link: PageLink): Promise<PageSection[]> {
        if (link.id !== 'home') {
            throw new Error(`Unknown Comix page: ${link.id}`)
        }

        const preferences = await loadComixPreferences()
        const home = await this.webView.getHome(
            buildComixPreferenceParams(preferences)
        )
        const highlights = (items: ComixManga[]) =>
            (items ?? []).map((manga) =>
                this.parser.parseHighlight(manga, preferences)
            )

        return [
            {
                id: 'trending',
                title: 'Most Recent Popular',
                style: SectionStyle.SimpleHeroPaged,
                items: highlights(home.trending)
            },
            {
                id: 'most-followed',
                title: 'Most Followed New Comics',
                style: SectionStyle.SimpleSingleRow,
                items: highlights(home.mostFollowed)
            },
            {
                id: 'latest',
                title: 'Latest Updates',
                style: SectionStyle.DetailedVerticalListGrouped,
                items: highlights(home.latest.items),
                viewMoreLink: {
                    request: {
                        page: 1,
                        listId: 'latest'
                    }
                }
            },
            {
                id: 'recently-added',
                title: 'Recently Added',
                style: SectionStyle.SimpleSingleRow,
                items: highlights(home.recentlyAdded.items),
                viewMoreLink: {
                    request: {
                        page: 1,
                        listId: 'recently-added'
                    }
                }
            }
        ]
    }

    async resolvePageSection(
        _link: PageLink,
        _sectionID: string
    ): Promise<ResolvedPageSection> {
        throw new Error('Comix page sections are returned fully resolved')
    }

    async willRequestImage(url: string) {
        return createComixImageRequest(url)
    }
}
