import { SearchRequest, SearchSectionType } from '@mana-app/types'
import { ComixFilterProps } from '../ComixInterfaces'
import {
    buildComixHomeSectionParams,
    buildComixSearchLookups,
    buildComixSearchParams,
    createComixSearchForm,
    createComixSortOptions
} from '../ComixSearch'

describe('Comix search helpers', () => {
    test('omits content rating restrictions by default', () => {
        const params = buildComixSearchParams({
            page: 1
        })

        expect(params).toEqual({
            page: 1,
            limit: 28,
            order: { chapter_updated_at: 'desc' }
        })
        expect(params).not.toHaveProperty('content_rating')
    })

    test('maps query, sort, inclusions, exclusions, and numeric filters', () => {
        const request: SearchRequest<ComixFilterProps> = {
            page: 3,
            query: 'villain',
            sort: { id: 'score:desc' },
            filters: {
                contentRating: { id: 'erotica', title: 'Up to Erotica' },
                types: [{ id: 'manhwa', title: 'Manhwa' }],
                statuses: [{ id: 'finished', title: 'Finished' }],
                demographics: [{ id: '2', title: 'Shounen' }],
                genres: {
                    included: [{ id: '6', title: 'Action' }],
                    excluded: [{ id: '87266', title: 'Hentai' }]
                },
                formats: {
                    included: [{ id: '93170', title: 'Long Strip' }],
                    excluded: []
                },
                tags: 'Demons, Time Travel',
                author: 'Author One, Author Two',
                artist: 'Artist One',
                matchMode: { id: 'or', title: 'Any selected term (OR)' },
                yearFrom: 2020,
                yearTo: 2026,
                minimumChapters: 25
            }
        }

        expect(buildComixSearchParams(request)).toEqual({
            page: 3,
            limit: 28,
            keyword: 'villain',
            sort: 'relevance:desc',
            content_rating: ['safe', 'suggestive', 'erotica'],
            types: ['manhwa'],
            statuses: ['finished'],
            demographics: ['2'],
            genres_in: ['6', '93170'],
            genres_ex: ['87266'],
            genres_mode: 'or',
            year_from: 2020,
            year_to: 2026,
            min_chap: 25
        })
        expect(buildComixSearchLookups(request.filters)).toEqual({
            tags: ['Demons', 'Time Travel'],
            authors: ['Author One', 'Author Two'],
            artists: ['Artist One']
        })
    })

    test('builds home pagination parameters and rejects unknown sections', () => {
        expect(buildComixHomeSectionParams('latest', 2)).toEqual({
            page: 2,
            limit: 28,
            scope: 'hot',
            order: { chapter_updated_at: 'desc' }
        })
        expect(buildComixHomeSectionParams('recently-added', 1)).toEqual({
            page: 1,
            limit: 28,
            order: { created_at: 'desc' }
        })
        expect(() => buildComixHomeSectionParams('missing', 1))
            .toThrow('Unknown Comix home section')
    })

    test('creates advanced filters and dynamic sort options', () => {
        const options = {
            genres: [{ id: 6, label: 'Action' }],
            formats: [{ id: 93170, label: 'Long Strip' }],
            types: [{ id: 'manga', label: 'Manga' }],
            statuses: [{ id: 'releasing', label: 'Releasing' }],
            demographics: [{ id: 2, label: 'Shounen' }],
            sorts: [
                ['chapter_updated_at:desc', 'Latest update'],
                ['title:asc', 'Title (A–Z)']
            ] as Array<[string, string]>
        }

        const form = createComixSearchForm(options)
        const sorts = createComixSortOptions(options)
        const childIDs = (sectionIndex: number): string[] => {
            const section = form.sections[sectionIndex]
            return section && 'children' in section
                ? section.children.map((field) => field.id)
                : []
        }

        expect(form.sections).toHaveLength(8)
        expect(form.sections.map((section) => section.header)).toEqual([
            undefined,
            undefined,
            'Type',
            'Demographic',
            'Content options',
            'Publication',
            'Credits & tags',
            'Sort'
        ])
        expect(form.sections.slice(0, 4).map((section) => section.type)).toEqual([
            SearchSectionType.LIST,
            SearchSectionType.LIST,
            SearchSectionType.TAGS,
            SearchSectionType.TAGS
        ])
        expect(form.sections.slice(0, 4).map((section) =>
            'field' in section
                ? section.field.id
                : 'children' in section ? section.children[0]?.id : undefined
        )).toEqual(['genres', 'formats', 'types', 'demographics'])
        expect(childIDs(4)).toEqual(['contentRating', 'matchMode'])
        const contentSection = form.sections[4]
        expect(contentSection && 'children' in contentSection
            ? contentSection.children.map((field) =>
                'presentation' in field ? field.presentation : undefined
            )
            : []
        ).toEqual([
            'menu',
            'menu'
        ])
        expect(childIDs(5)).toEqual([
            'statuses',
            'minimumChapters',
            'yearFrom',
            'yearTo'
        ])
        expect(childIDs(6)).toEqual([
            'tags',
            'author',
            'artist'
        ])
        expect(sorts).toEqual([
            expect.objectContaining({
                id: 'chapter_updated_at:desc',
                isDefault: true,
                isOrderable: false
            }),
            expect.objectContaining({
                id: 'title:asc',
                isDefault: false,
                isOrderable: false
            })
        ])
    })
})
