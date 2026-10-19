import { ContentRating, UIComponentType, UISectionType } from '@mana-app/types'
import { createAtsumaruPreferenceMenu } from '../AtsumaruPreferenceForm'
import {
    DEFAULT_ATSUMARU_PREFERENCES,
    loadAtsumaruPreferences
} from '../AtsumaruPreferences'
import {
    allowedAtsumaruRatings,
    buildAtsumaruListRequest,
    buildAtsumaruSearchUrl
} from '../AtsumaruSearch'

describe('Atsumaru preferences', () => {
    beforeEach(() => {
        const values = new Map<string, unknown>()
        Object.defineProperty(globalThis, 'ObjectStore', {
            configurable: true,
            value: {
                async stringArray(key: string) {
                    const value = values.get(key)
                    return Array.isArray(value) ? value : null
                },
                async set(key: string, value: unknown) { values.set(key, value) }
            }
        })
    })

    test('loads the unrestricted comic defaults', async () => {
        await expect(loadAtsumaruPreferences()).resolves.toEqual(
            DEFAULT_ATSUMARU_PREFERENCES
        )
    })

    test('applies content preferences to search and Home requests', () => {
        const preferences = {
            ...DEFAULT_ATSUMARU_PREFERENCES,
            types: ['Manga'],
            excludedGenres: ['46'],
            excludedTags: ['250']
        }
        const context = {
            allowedContentRatings: [ContentRating.SAFE, ContentRating.SUGGESTIVE]
        }
        const searchUrl = new URL(buildAtsumaruSearchUrl(
            { page: 1, context },
            40,
            preferences
        ))
        const filter = searchUrl.searchParams.get('filter_by') ?? ''
        expect(filter).toContain('type:=[`Manga`]')
        expect(filter).toContain('mbContentRating:=[`Safe`,`Suggestive`]')
        expect(filter).toContain('genreIds:!=[`46`]')
        expect(filter).toContain('tagIds:!=[`250`]')

        const homeUrl = new URL(buildAtsumaruListRequest(
            'popular',
            1,
            15,
            context,
            preferences
        ).url)
        expect(homeUrl.searchParams.get('types')).toBe('Manga')
        expect(homeUrl.searchParams.get('contentRatings')).toBe('Safe,Suggestive')
        expect(homeUrl.searchParams.get('excludedTags')).toBe('46,250')
        expect(homeUrl.searchParams.has('adult')).toBe(false)
        expect(allowedAtsumaruRatings(context)).toEqual(['Safe', 'Suggestive'])
    })

    test('lets explicit Search inclusions override saved exclusions', () => {
        const url = new URL(buildAtsumaruSearchUrl({
            page: 1,
            filters: {
                genres: {
                    included: [{ id: '46', title: 'Adult' }],
                    excluded: []
                }
            }
        }, 40, {
            ...DEFAULT_ATSUMARU_PREFERENCES,
            excludedGenres: ['46', '39']
        }))
        const filter = url.searchParams.get('filter_by') ?? ''
        expect(filter).toContain('genreIds:=`46`')
        expect(filter).toContain('genreIds:!=[`39`]')
        expect(filter).not.toContain('genreIds:!=[`46`')
    })

    test('exposes the site content preferences relevant to a comic source', () => {
        const form = createAtsumaruPreferenceMenu({
            genres: [{ id: '39', name: 'Action' }],
            tags: [{ id: '250', name: 'Murder', group: 'Activities' }],
            types: [
                { id: 'Manga', name: 'Manga' },
                { id: 'Other', name: 'Other' }
            ]
        }, DEFAULT_ATSUMARU_PREFERENCES)

        expect(form.sections.map((section) => section.header)).toEqual([
            'Types',
            'Excluded genres & tags'
        ])
        expect(form.sections[0]?.type).toBe(UISectionType.TAGS)
        expect(form.sections[1]?.type).toBe(UISectionType.LIST)
        const fields = form.sections.flatMap((section) =>
            'children' in section
                ? section.children.map((field) => field.id)
                : [section.field.id]
        )
        expect(fields).toEqual([
            'types',
            'excludedGenres',
            expect.stringMatching(/^x_[a-z0-9]{1,7}$/)
        ])
        const exclusions = form.sections[1]
        if (!exclusions || !('children' in exclusions)) {
            throw new Error('Missing exclusion settings')
        }
        expect(exclusions.children.every((field) =>
            'presentation' in field && field.presentation === 'sheet'
        )).toBe(true)
        expect(exclusions.groups).toEqual([{
            id: 'tags',
            title: 'Tags',
            fieldIds: exclusions.children
                .filter((field) => field.id.startsWith('x_'))
                .map((field) => field.id)
        }])
        const typeSection = form.sections[0]
        expect(typeSection && 'field' in typeSection
            ? typeSection.field.options.map((option) => option.id)
            : []).toEqual(['Manga', 'Manwha', 'Manhua', 'OEL'])
    })

    test('category edits preserve exclusions in other categories', async () => {
        const form = createAtsumaruPreferenceMenu({
            tags: [
                { id: '250', name: 'Murder', group: 'Activities' },
                { id: '248', name: 'Working', group: 'Activities' },
                { id: '421', name: 'Body Horror', group: 'Themes' }
            ]
        }, { ...DEFAULT_ATSUMARU_PREFERENCES, excludedTags: ['248', '421'] })
        const fields = form.sections.flatMap((section) =>
            'children' in section
                ? section.children.filter((field) => field.id.startsWith('x_'))
                : []
        )
        const activities = fields.find((field) => field.title === 'Activities')
        const themes = fields.find((field) => field.title === 'Themes')
        if (activities?.type !== UIComponentType.MULTISELECT ||
            themes?.type !== UIComponentType.MULTISELECT) {
            throw new Error('Missing category pickers')
        }

        expect(activities.value).toEqual(['248'])
        expect(themes.value).toEqual(['421'])
        await activities.didChange?.(['250'])
        expect(await ObjectStore.stringArray('Atsumaru.excludedTags'))
            .toEqual(['421', '250'])
        await themes.didChange?.([])
        expect(await ObjectStore.stringArray('Atsumaru.excludedTags'))
            .toEqual(['250'])
        await activities.didChange?.(['248'])
        expect((await loadAtsumaruPreferences()).excludedTags).toEqual(['248'])
    })
})
