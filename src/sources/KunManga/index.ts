import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://kunmanga.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'KunManga',
        version: getExportVersion('0.0.0'),
        name: 'KunManga',
        thumbnail: 'KunManga.png',
        rating: CatalogRating.SAFE,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}