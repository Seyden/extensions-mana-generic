import {
    CatalogRating,
    SectionStyle,
    SourceInfo
} from '@mana-app/types'
import { HomeSectionDefinition, StatusTypes } from './AsuraScansInterfaces'

export const ASURASCANS_DOMAIN = 'https://asurascans.com'
export const ASURASCANS_API_DOMAIN = 'https://api.asurascans.com'

export const SOURCE_INFO: SourceInfo = {
    id: 'AsuraScans',
    version: "1.0.1",
    name: 'AsuraScans',
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

export const HOME_SECTIONS: readonly HomeSectionDefinition[] = [
    { id: 'trending_today', title: 'Trending', style: SectionStyle.SimpleHeroPaged, kind: 'trending', period: 'trending' },
    { id: 'latest_update', title: 'Latest Updates', style: SectionStyle.DetailedVerticalListGrouped, kind: 'latest' },
    { id: 'weekly', title: 'Weekly', style: SectionStyle.SimpleSingleRow, kind: 'trending', period: 'week' },
    { id: 'monthly', title: 'Monthly', style: SectionStyle.SimpleSingleRow, kind: 'trending', period: 'month' },
    { id: 'all_time', title: 'All Time', style: SectionStyle.SimpleSingleRow, kind: 'trending', period: 'all' }
]
