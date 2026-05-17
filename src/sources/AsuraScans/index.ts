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
    SearchFilter,
    SearchRequest,
    SourceInfo
} from '@mana-app/types'
import { HomeSectionData, loadCheerioData } from './AsuraScansHelper'
import { HOME_SECTIONS, SOURCE_INFO, STATUS_TYPES } from './AsuraScansInfo'
import { FilterProps, StatusTypes } from './AsuraScansInterfaces'
import { AsuraScansBase } from './AsuraScansBase'
import { getContent, getChapters, getChapterData } from './AsuraScansContent'
import { search, getSearchFilters, constructSearchUrl } from './AsuraScansSearch'

export class Target extends AsuraScansBase implements ContentSource, PageLinkResolver {

    info: SourceInfo = SOURCE_INFO
    manga_StatusTypes: StatusTypes = STATUS_TYPES
    sections: Record<'trending_today' | 'latest_update' | 'latest_update2', HomeSectionData> = HOME_SECTIONS

    async getContent(mangaId: string): Promise<Content> { return getContent(this.client, this.parser, mangaId, this) }
    async getChapters(mangaId: string): Promise<Chapter[]> { return getChapters(this.client, this.parser, mangaId, this) }
    async getChapterData(mangaId: string, chapterId: string, chapter?: Chapter): Promise<ChapterData> { return getChapterData(this.client, this.parser, mangaId, chapterId, chapter) }

    async getSearchFilters(): Promise<SearchFilter[]> { return getSearchFilters(this.client, this.parser) }
    async search(searchRequest: SearchRequest<FilterProps>): Promise<PagedSearchResult> { return search(this.client, this.parser, searchRequest) }
    async constructSearchRequest(page: number, query: SearchRequest<FilterProps>): Promise<any> {
        return { url: constructSearchUrl((page - 1) * 20, query), method: 'GET' }
    }

    async getSectionsForPage(link: PageLink): Promise<PageSection[]> {
        if (link.id !== 'home') throw new Error('Accessing invalid page')

        const url = await this.getBaseUrl()
        const $ = await loadCheerioData(this.client, `${url}/`)
        const sectionValues = Object.values(this.sections).sort((a, b) => a.sortIndex - b.sortIndex)

        return Promise.all(
            sectionValues
                .filter(s => s.enabled)
                .map(async (section) => {
                    section.section.items = await this.parser.parseHomeSection($, section, this)
                    return section.section
                })
        )
    }
}
