import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://coffeemanga.io'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'CoffeeManga',
        version: getExportVersion('0.0.0'),
        name: 'CoffeeManga',
        thumbnail: 'CoffeeManga.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}