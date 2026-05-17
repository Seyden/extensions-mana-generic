import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://novelmic.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'NovelMic',
        version: getExportVersion('0.0.0'),
        name: 'NovelMic',
        thumbnail: 'NovelMic.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN
}