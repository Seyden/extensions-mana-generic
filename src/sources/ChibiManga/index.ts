import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://www.cmreader.info'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'ChibiManga',
        version: getExportVersion('0.0.0'),
        name: 'ChibiManga',
        thumbnail: 'ChibiManga.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}