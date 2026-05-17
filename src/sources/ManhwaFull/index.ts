import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://manhwafull.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'ManhwaFull',
        version: getExportVersion('0.0.0'),
        name: 'ManhwaFull',
        thumbnail: 'ManhwaFull.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}