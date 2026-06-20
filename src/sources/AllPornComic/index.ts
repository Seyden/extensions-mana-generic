import { SourceInfo, CatalogRating } from "@mana-app/types";

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://allporncomic.com'
export class Target extends Madara {

    info: SourceInfo = {
        id: 'AllPornComic',
        version: getExportVersion('0.0.0'),
        name: 'AllPornComic',
        thumbnail: 'AllPornComic.png',
        rating: CatalogRating.EXPLICIT,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override chapterEndpoint = 1
}