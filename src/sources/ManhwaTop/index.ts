import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://manhwatop.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'ManhwaTop',
        version: getExportVersion('0.0.0'),
        name: 'ManhwaTop',
        thumbnail: 'ManhwaTop.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN
}