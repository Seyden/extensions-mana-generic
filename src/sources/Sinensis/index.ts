import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://sinensisscans.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'Sinensis',
        version: getExportVersion('0.0.0'),
        name: 'Sinensis',
        thumbnail: 'Sinensis.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
        
    }

    baseUrl: string = DOMAIN

    override language = 'pt_PT'

    override chapterEndpoint = 1

    override hasProtectedChapters = true
}