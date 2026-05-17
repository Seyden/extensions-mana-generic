import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://setsuscans.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'SetsuScans',
        version: getExportVersion('0.0.0'),
        name: 'SetsuScans',
        thumbnail: 'SetsuScans.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}