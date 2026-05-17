import { SourceInfo, CatalogRating } from "@mana-app/types";

import {
    getExportVersion,
    Madara
} from '../../templates/Madara/Madara'

const DOMAIN = 'https://arthurscan.xyz'

export class Target extends Madara {

    info: SourceInfo = {
        id: 'ArthurScan',
        version: getExportVersion('0.0.0'),
        name: 'ArthurScan',
        thumbnail: 'ArthurScan.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN
    }

    baseUrl: string = DOMAIN

    override language = 'pt_PT'

    override chapterEndpoint = 1
}