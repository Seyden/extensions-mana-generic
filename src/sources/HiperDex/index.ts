import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://hiperdex.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'HiperDex',
        version: getExportVersion('0.0.0'),
        name: 'HiperDex',
        thumbnail: 'HiperDex.png',
        rating: CatalogRating.EXPLICIT,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}