import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://immortalupdates.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'ImmortalUpdates',
        version: getExportVersion('0.0.0'),
        name: 'ImmortalUpdates',
        thumbnail: 'ImmortalUpdates.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}