import {
    SourceInfo,
    CatalogRating,
    PageLink,
    PageSection,
    SectionStyle
} from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

import {
    SamuraiScanParser
} from './SamuraiScanParser'

import { load } from "cheerio";

const DOMAIN = 'https://samuraiscan.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'SamuraiScan',
        version: getExportVersion('0.0.0'),
        name: 'SamuraiScan',
        thumbnail: 'SamuraiScan.png',
        rating: CatalogRating.EXPLICIT,
        website: DOMAIN,

    }

    baseUrl: string = DOMAIN

    override language = 'es_ES'

    override chapterEndpoint = 1

    override parser: SamuraiScanParser = new SamuraiScanParser()

    override async getSectionsForPage(link: PageLink): Promise<PageSection[]> {
        if (link.id !== "home")
            throw new Error("Accessing invalid page")

        const sections: { request: any, section: PageSection }[] = [
            {
                request: this.constructAjaxHomepageRequest(0, 10, '_wp_manga_week_views_value'),
                section: {
                    id: '0',
                    title: 'Currently Trending',
                    style: SectionStyle.SimpleHeroPaged,
                    viewMoreLink: { request: { page: 1, listId: "0" } }
                }
            },
            {
                request: this.constructAjaxHomepageRequest(0, 10, '_latest_update'),
                section: {
                    id: '1',
                    title: 'Recently Updated',
                    style: SectionStyle.SimpleSingleRow,
                    viewMoreLink: { request: { page: 1, listId: "1" } }
                }
            },
            {
                request: this.constructAjaxHomepageRequest(0, 10, '_wp_manga_views'),
                section: {
                    id: '2',
                    title: 'Most Popular',
                    style: SectionStyle.SimpleSingleRow,
                    viewMoreLink: { request: { page: 1, listId: "2" } }
                }
            }
        ]

        const promises: Promise<PageSection>[] = []
        for (const section of sections) {
            // Get the section data
            promises.push(
                this.client.request(section.request).then(async response => {
                    this.checkResponseError(response)
                    const $ = load(response.data as string)
                    section.section.items = await this.parser.parseHomeSection($, this)
                    return section.section
                })
            )
        }

        // Make sure the function completes
        return await Promise.all(promises)
    }

}