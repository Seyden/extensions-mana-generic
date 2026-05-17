import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://pianmanga.me'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'PianManga',
        version: getExportVersion('0.0.0'),
        name: 'PianManga',
        thumbnail: 'PianManga.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1

    override usePostIds = false
}