import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://1st-kissmanga.net'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'KissManga',
        version: getExportVersion('0.0.0'),
        name: 'KissManga',
        thumbnail: 'KissManga.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1

    override usePostIds = true
}