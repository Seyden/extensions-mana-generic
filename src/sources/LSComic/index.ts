import { SourceInfo, CatalogRating } from '@mana-app/types'

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://lscomic.com'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'LSComic',
        version: getExportVersion('0.0.0'),
        name: 'LSComic',
        thumbnail: 'LSComic.png',
        rating: CatalogRating.SAFE,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}