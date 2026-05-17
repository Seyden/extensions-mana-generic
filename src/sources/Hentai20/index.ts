import { SourceInfo, CatalogRating } from "@mana-app/types";

import {
    getExportVersion,
    MangaStream
} from '../../templates/MangaStream/MangaStream'

const DOMAIN = 'https://hentai20.io'

export class Target extends MangaStream {

    info: SourceInfo = {
        id: 'Hentai20',
        version: getExportVersion('0.0.0'),
        name: 'Hentai20',
        thumbnail: 'Hentai20.png',
        rating: CatalogRating.NSFW,
        website: DOMAIN,
    }

    baseUrl: string = DOMAIN

    override configureSections() {
        this.sections['new_titles'].enabled = false
    }
}