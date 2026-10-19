import { UISectionType } from '@mana-app/types'
import {
    buildComixPreferenceParams,
    contentRatingsForPreference,
    DEFAULT_COMIX_PREFERENCES
} from '../ComixPreferences'
import { createComixPreferenceMenu } from '../ComixPreferenceForm'

describe('Comix preferences', () => {
    test('keeps show-all as the unrestricted default', () => {
        expect(contentRatingsForPreference('all')).toBeUndefined()
        expect(buildComixPreferenceParams(DEFAULT_COMIX_PREFERENCES)).toEqual({})
    })

    test('expands maximum ratings and catalog defaults', () => {
        expect(contentRatingsForPreference('erotica')).toEqual([
            'safe',
            'suggestive',
            'erotica'
        ])
        expect(buildComixPreferenceParams({
            ...DEFAULT_COMIX_PREFERENCES,
            contentRating: 'suggestive',
            defaultTypes: ['manga', 'manhwa'],
            defaultDemographics: ['2'],
            blockedGenres: ['87266']
        })).toEqual({
            content_rating: ['safe', 'suggestive'],
            types: ['manga', 'manhwa'],
            demographics: ['2'],
            genres_ex: ['87266'],
            genres_mode: 'and'
        })
    })

    test('exposes every Keiyoushi-equivalent source setting', () => {
        const form = createComixPreferenceMenu({
            genres: [{ id: 6, label: 'Action' }],
            types: [{ id: 'manga', label: 'Manga' }],
            demographics: [{ id: 2, label: 'Shounen' }]
        }, DEFAULT_COMIX_PREFERENCES)
        const sections = form.sections as unknown as Array<{
            header: string
            footer: string
            type?: UISectionType
            children?: Array<{ id: string; optional?: boolean }>
            field?: { id: string; optional?: boolean }
        }>

        expect(sections).toHaveLength(6)
        expect(sections.map((section) => section.header)).toEqual([
            'Artwork',
            'Content filtering',
            'Blocked genres',
            'Chapter releases',
            'Scanlator blacklist',
            'Title details'
        ])
        expect(sections.every((section) => section.footer.length > 0)).toBe(true)
        expect(sections[2]).toMatchObject({
            type: UISectionType.TAGS,
            field: { id: 'blockedGenres', optional: true }
        })
        expect(sections[1]?.children?.filter((child) =>
            ['defaultTypes', 'defaultDemographics'].includes(child.id)
        )).toEqual([
            expect.objectContaining({ id: 'defaultTypes', optional: true }),
            expect.objectContaining({
                id: 'defaultDemographics',
                optional: true
            })
        ])
        expect(sections.flatMap((section) =>
            section.children?.map((child) => child.id) ??
                (section.field ? [section.field.id] : [])
        )).toEqual([
            'posterQuality',
            'contentRating',
            'defaultTypes',
            'defaultDemographics',
            'blockedGenres',
            'deduplicateChapters',
            'scanlatorBlacklist',
            'showAlternativeTitlesInSummary',
            'showExtraInfo',
            'showNarrativeTags',
            'scorePosition'
        ])
    })
})
