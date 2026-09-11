import {
    CatalogRating,
    SourceInfo
} from '@mana-app/types'
import {
    getExportVersion,
    Iken
} from '../../templates/Iken/Iken'

const DOMAIN = 'https://vortexscans.org'

export class Target extends Iken {
    info: SourceInfo = {
        id: 'VortexScans',
        version: getExportVersion('0.0.0'),
        name: 'Vortex Scans',
        thumbnail: 'VortexScans.png',
        rating: CatalogRating.MIXED,
        website: DOMAIN,
        badges: [
            'Manga',
            'Manhua',
            'Manhwa'
        ],
        supportedLanguages: ['en_GB']
    }

    baseUrl = DOMAIN
}
