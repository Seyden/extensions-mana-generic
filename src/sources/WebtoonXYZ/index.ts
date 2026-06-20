import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://www.webtoon.xyz'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'WebtoonXYZ',
        version: getExportVersion('0.0.0'),
        name: 'WebtoonXYZ',
        thumbnail: 'WebtoonXYZ.png',
        rating: CatalogRating.EXPLICIT,
        website: DOMAIN,

    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}