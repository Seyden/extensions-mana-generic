/* eslint-disable linebreak-style */
import { SourceInfo, CatalogRating } from "@mana-app/types";

import {
    getExportVersion,
    MangaStream
} from '../../templates/MangaStream/MangaStream'

const INFERNALVOIDSCANS_DOMAIN = 'https://hivetoon.com'

export class Target extends MangaStream {

    info: SourceInfo = {
        id: 'InfernalVoidScans',
        version: getExportVersion('0.0.0'),
        name: 'InfernalVoidScans',
        thumbnail: 'InfernalVoidScans.png',
        rating: CatalogRating.MIXED,
        website: INFERNALVOIDSCANS_DOMAIN,
    }

    baseUrl: string = INFERNALVOIDSCANS_DOMAIN

    override configureSections() {
        this.sections['new_titles'].enabled = false
    }
}