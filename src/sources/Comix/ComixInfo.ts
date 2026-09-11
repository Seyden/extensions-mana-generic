import { CatalogRating, SourceInfo } from '@mana-app/types'

export const COMIX_DOMAIN = 'https://comix.to'
export const COMIX_LANGUAGE = 'en_US'

export const COMIX_SOURCE_INFO: SourceInfo = {
    id: 'Comix',
    version: '1.0.1',
    name: 'Comix',
    description: 'Read manga, manhwa, manhua, and comics from Comix.',
    thumbnail: 'Comix.png',
    rating: CatalogRating.MIXED,
    website: COMIX_DOMAIN,
    supportedLanguages: [COMIX_LANGUAGE],
    badges: [
        'Manga',
        'Manhwa',
        'Manhua'
    ],
    developers: [
        {
            name: 'Seyden',
            avatarUrl: 'https://avatars.githubusercontent.com/u/639817',
            github: 'https://github.com/Seyden'
        }
    ]
}
