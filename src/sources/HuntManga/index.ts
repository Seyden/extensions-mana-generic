import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://huntmanga.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'HuntManga',
        version: getExportVersion('0.0.0'),
        name: 'HuntManga',
        thumbnail: 'HuntManga.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}