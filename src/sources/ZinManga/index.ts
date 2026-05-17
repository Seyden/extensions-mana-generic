import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://zinmanga.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'ZinManga',
        version: getExportVersion('0.0.0'),
        name: 'ZinManga',
        thumbnail: 'ZinManga.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1

    override usePostIds = false
}