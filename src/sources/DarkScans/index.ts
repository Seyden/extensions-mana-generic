import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://darkscans.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'DarkScans',
        version: getExportVersion('0.0.0'),
        name: 'DarkScans',
        thumbnail: 'DarkScans.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}