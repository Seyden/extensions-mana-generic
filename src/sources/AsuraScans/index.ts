/* eslint-disable linebreak-style */

import {
    Chapter,
    ChapterData,
    Content,
    ContentSource,
    PagedSearchResult,
    PageLink,
    PageLinkResolver,
    PageSection,
    SearchForm,
    SearchRequest,
    SortOption,
    SourceContext,
    SourceInfo
} from '@mana-app/types'
import { AsuraScansApi, SERIES_PAGE_LIMIT } from './AsuraScansApi'
import { HOME_SECTIONS, SOURCE_INFO, STATUS_TYPES } from './AsuraScansInfo'
import { FilterProps, StatusTypes } from './AsuraScansInterfaces'
import { AsuraScansBase } from './AsuraScansBase'
import { getContent, getChapters, getChapterData } from './AsuraScansContent'
import { search, getSearchForm, constructSearchUrl, getSortOptions } from './AsuraScansSearch'

export class Target extends AsuraScansBase implements ContentSource, PageLinkResolver {

    info: SourceInfo = SOURCE_INFO
    manga_StatusTypes: StatusTypes = STATUS_TYPES
    private readonly api = new AsuraScansApi(this.client)

    async getContent(mangaId: string, _?: SourceContext): Promise<Content> {
        return getContent(this.client, this.parser, mangaId, this)
    }
    async getChapters(mangaId: string): Promise<Chapter[]> { return getChapters(this.client, this.parser, mangaId, this) }
    async getChapterData(mangaId: string, chapterId: string, chapter?: Chapter): Promise<ChapterData> { return getChapterData(this.client, this.parser, mangaId, chapterId, chapter) }

    async getSortOptions(): Promise<SortOption[]> { return getSortOptions() }
    async getSearchForm(): Promise<SearchForm> { return getSearchForm(this.client, this.parser) }
    async search(searchRequest: SearchRequest<FilterProps>): Promise<PagedSearchResult> {
        return search(this.api, this.parser, searchRequest, await this.getBaseUrl(), this.fallbackImage)
    }
    async constructSearchRequest(page: number, query: SearchRequest<FilterProps>): Promise<any> {
        return { url: constructSearchUrl((page - 1) * SERIES_PAGE_LIMIT, query), method: 'GET' }
    }

    async getSectionsForPage(link: PageLink): Promise<PageSection[]> {
        if (link.id !== 'home') throw new Error('Accessing invalid page')

        const baseUrl = await this.getBaseUrl()
        return Promise.all(HOME_SECTIONS.map(async (definition): Promise<PageSection> => {
            const { id, title, style } = definition
            if (definition.kind === 'latest') {
                const { data } = await this.api.getSeriesPage({ page: 1, listId: id })
                return {
                    id, title, style,
                    subtitle: 'Your daily dose of the latest updates',
                    items: this.parser.parseSeriesItems(data, baseUrl, this.fallbackImage, true),
                    viewMoreLink: { request: { page: 1, listId: id } }
                }
            }
            const { data } = await this.api.getTrending(definition.period)
            return { id, title, style, items: this.parser.parseTrendingItems(data, baseUrl, this.fallbackImage) }
        }))
    }
}
