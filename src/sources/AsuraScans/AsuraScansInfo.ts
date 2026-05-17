import {
    CatalogRating,
    SectionStyle,
    SourceInfo
} from '@mana-app/types'
import { createHomeSection, HomeSectionData } from './AsuraScansHelper'
import { StatusTypes } from './AsuraScansInterfaces'

export const ASURASCANS_DOMAIN = 'https://asurascans.com'
export const ASURASCANS_API_DOMAIN = 'https://api.asurascans.com'

export const SOURCE_INFO: SourceInfo = {
    id: 'AsuraScans',
    version: "1.0.0",
    name: 'AsuraScans',
    description: 'AsuraScans is a manga reader that allows you to read manga online.',
    thumbnail: 'AsuraScans.png',
    rating: CatalogRating.MIXED,
    website: ASURASCANS_DOMAIN,
    developers: [
        {
            name: 'Seyden',
            avatarUrl: 'https://avatars.githubusercontent.com/u/639817',
            github: 'https://github.com/Seyden'
        },
        {
            name: 'Mana',
            avatarUrl: 'https://avatars.githubusercontent.com/u/226497536',
            github: 'https://github.com/Mana-iOS'
        },
    ],
    badges: [
        'Novel',
        'Manhwa',
    ],
    supportedLanguages: ['en_GB']
}

export const STATUS_TYPES: StatusTypes = {
    COMINGSOON: 'COMING SOON',
    HIATUS: 'HIATUS',
    SEASONEND: 'SEASON END',
    ONGOING: 'ONGOING',
    COMPLETED: 'COMPLETED',
    DROPPED: 'DROPPED'
}

export const HOME_SECTIONS: Record<'trending_today' | 'latest_update' | 'latest_update2', HomeSectionData> = {
    'trending_today': {
        section: createHomeSection('trending_today', 'Trending Today', undefined, false, SectionStyle.SimpleHeroPaged),
        enabled: true,
        sortIndex: 10,
        componentName: 'Trending',
    },
    'latest_update': {
        section: createHomeSection('latest_update', 'Latest Updates', "Your daily dose of the latest updates", true, SectionStyle.DetailedVerticalListGrouped),
        enabled: true,
        sortIndex: 20,
        componentName: 'LatestUpdates',
    },
    'latest_update2': {
        section: createHomeSection('latest_update2', 'Latest Updates 2', "Your daily dose of the latest updates", true, SectionStyle.SimpleTripleRow),
        enabled: true,
        sortIndex: 30,
        componentName: 'LatestUpdates',
    },
}
