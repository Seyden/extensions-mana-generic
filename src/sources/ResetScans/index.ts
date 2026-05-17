import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://reset-scans.xyz'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'ResetScans',
        version: getExportVersion('0.0.0'),
        name: 'ResetScans',
        thumbnail: 'ResetScans.png',
        rating: CatalogRating.SAFE,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}