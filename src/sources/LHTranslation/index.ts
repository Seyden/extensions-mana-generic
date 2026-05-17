import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://lhtranslation.net'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'LHTranslation',
        version: getExportVersion('0.0.0'),
        name: 'LHTranslation',
        thumbnail: 'LHTranslation.png',
        rating: CatalogRating.SAFE,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}