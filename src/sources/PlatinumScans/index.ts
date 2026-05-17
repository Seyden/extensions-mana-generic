import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://platinumscans.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'PlatinumScans',
        version: getExportVersion('0.0.0'),
        name: 'PlatinumScans',
        thumbnail: 'PlatinumScans.png',
        rating: CatalogRating.SAFE,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override hasAdvancedSearchPage = false
}