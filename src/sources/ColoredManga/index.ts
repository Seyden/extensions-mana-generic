import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://coloredmanga.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'ColoredManga',
        version: getExportVersion('0.0.0'),
        name: 'ColoredManga',
        thumbnail: 'ColoredManga.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}