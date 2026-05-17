import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://astrallibrary.net'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'AstralLibrary',
        version: getExportVersion('0.0.0'),
        name: 'AstralLibrary',
        thumbnail: 'AstralLibrary.png',
        rating: CatalogRating.SAFE,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}