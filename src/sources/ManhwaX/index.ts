/* eslint-disable linebreak-style */
import { SourceInfo, CatalogRating } from "@mana-app/types";

import {
    getExportVersion,
    MangaStream
} from '../../templates/MangaStream/MangaStream'

const MANHWAX_DOMAIN = 'https://manhwax.org'

export class Target extends MangaStream {

    info: SourceInfo = {
        id: 'ManhwaX',
        version: getExportVersion('0.0.0'),
        name: 'ManhwaX',
        thumbnail: 'ManhwaX.png',
        rating: CatalogRating.EXPLICIT,
        website: MANHWAX_DOMAIN,
    }

    baseUrl: string = MANHWAX_DOMAIN

    override configureSections() {
        this.sections['popular_today'].enabled = false
        this.sections['latest_update'].selectorFunc = ($: CheerioStatic) => $('div.bsx', $('h2:contains(Latest Update)')?.parent()?.next())
        this.sections['latest_update'].subtitleSelectorFunc = ($: CheerioStatic, element: CheerioElement) => $('div.epxs', element).text().trim()
        this.sections['new_titles'].enabled = false
    }
}