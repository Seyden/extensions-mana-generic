import {
    ContentRating,
    FilterType,
    SearchSectionType,
    SectionStyle
} from '@mana-app/types'
import {
    ATSUMARU_HOME_SECTIONS,
    buildAtsumaruListRequest,
    buildAtsumaruSearchUrl,
    createAtsumaruSearchForm,
    createAtsumaruSortOptions,
    allowedAtsumaruRatings
} from '../AtsumaruSearch'
import { Target } from '../index'

describe('AtsumaruSearch', () => {
    test('exports the Atsumaru Mana target', () => {
        expect(Target).toBeDefined()
    })

    test('builds an unrestricted adult-inclusive default search', () => {
        const url = new URL(buildAtsumaruSearchUrl({ page: 1 }))
        const filters = url.searchParams.get('filter_by') ?? ''

        expect(url.searchParams.get('q')).toBe('*')
        expect(url.searchParams.get('sort_by')).toBe('views:desc')
        expect(url.searchParams.get('page')).toBe('1')
        expect(url.searchParams.get('per_page')).toBe('40')
        expect(filters).toContain('hidden:!=true')
        expect(filters).toContain('medium:=[`Comic`]')
        expect(filters).not.toContain('isAdult')
        expect(filters).not.toContain('mbContentRating')
    })

    test('maps query, filters, sorting, and pagination into Typesense parameters', () => {
        const url = new URL(buildAtsumaruSearchUrl({
            query: 'witch hat',
            page: 3,
            sort: { id: 'title', ascending: true },
            filters: {
                genres: {
                    included: [{ id: '1', title: 'Action' }],
                    excluded: [{ id: '2', title: 'Adult' }]
                },
                t_a: {
                    included: [{ id: '10', title: 'Magic' }],
                    excluded: []
                },
                t_b: {
                    included: [{ id: '11', title: 'School' }],
                    excluded: [{ id: '12', title: 'Castle' }]
                },
                types: [{ id: 'Manga', title: 'Manga' }],
                statuses: [{ id: 'Ongoing', title: 'Ongoing' }],
                year: 2024,
                minimumChapters: 12,
                officialTranslation: true
            }
        }))
        const filters = url.searchParams.get('filter_by') ?? ''

        expect(url.searchParams.get('q')).toBe('witch hat')
        expect(url.searchParams.get('query_by'))
            .toBe('title,englishTitle,otherNames,authors')
        expect(url.searchParams.get('sort_by')).toBe('title:asc')
        expect(url.searchParams.get('page')).toBe('3')
        expect(filters).toContain('genreIds:=`1`')
        expect(filters).toContain('genreIds:!=[`2`]')
        expect(filters).toContain('tagIds:=`10` && tagIds:=`11`')
        expect(filters).toContain('tagIds:!=[`12`]')
        expect(filters).toContain('type:=[`Manga`]')
        expect(filters).toContain('status:=[`Ongoing`]')
        expect(filters).toContain('releaseYear:=2024')
        expect(filters).toContain('chapterCount:>=12')
        expect(filters).toContain('officialTranslation:=true')
    })

    test('applies the app allowed content ratings to search and Home', () => {
        const context = {
            allowedContentRatings: [
                ContentRating.SAFE,
                ContentRating.SUGGESTIVE,
                ContentRating.MATURE
            ]
        }
        const searchUrl = new URL(buildAtsumaruSearchUrl({ page: 1, context }))
        const filters = searchUrl.searchParams.get('filter_by') ?? ''

        expect(filters).toContain(
            'mbContentRating:=[`Safe`,`Suggestive`,`Erotica`]'
        )
        expect(filters).toContain('isAdult:=false')
        expect(filters).not.toContain('Pornographic')

        const homeUrl = new URL(
            buildAtsumaruListRequest('hot-updates', 1, 15, context).url
        )
        expect(homeUrl.searchParams.has('adult')).toBe(false)
        expect(homeUrl.searchParams.get('contentRatings'))
            .toBe('Safe,Suggestive,Erotica')

        const noneAllowed = { allowedContentRatings: [] }
        expect(allowedAtsumaruRatings(noneAllowed)).toEqual([])
        expect(new URL(buildAtsumaruSearchUrl({ page: 1, context: noneAllowed }))
            .searchParams.get('filter_by'))
            .toContain('id:=`__mana_no_visible_rating__`')
    })

    test('skips Atsumaru requests when no app rating is allowed', async () => {
        const context = { allowedContentRatings: [] }
        const api = {
            getBrowse: jest.fn(),
            getSearch: jest.fn()
        }
        const target = Object.create(Target.prototype) as Target
        Object.defineProperty(target, 'api', { value: api })

        await expect(target.search({ page: 1, context })).resolves.toEqual({
            results: [],
            isLastPage: true,
            totalResultCount: 0
        })
        await expect(target.resolvePageSection(
            { id: 'home', context },
            'popular'
        )).resolves.toEqual({ items: [] })
        expect(api.getBrowse).not.toHaveBeenCalled()
        expect(api.getSearch).not.toHaveBeenCalled()
    })

    test('defines Home sections and paged adult-inclusive list requests', () => {
        expect(ATSUMARU_HOME_SECTIONS.map((section) => section.id)).toEqual([
            'popular',
            'hot-updates',
            'trending',
            'recently-updated',
            'recently-added',
            'top-rated',
            'most-bookmarked'
        ])

        const popular = buildAtsumaruListRequest('popular', 2, 15)
        const popularUrl = new URL(popular.url)
        expect(popular.kind).toBe('browse')
        expect(popularUrl.pathname).toBe('/api/home2/popular')
        expect(popularUrl.searchParams.get('offset')).toBe('15')
        expect(popularUrl.searchParams.get('limit')).toBe('15')
        expect(popularUrl.searchParams.get('adult')).toBe('1')
        expect(popularUrl.searchParams.get('timeframe')).toBe('daily')

        const hotUpdates = buildAtsumaruListRequest('hot-updates', 1, 15)
        expect(new URL(hotUpdates.url).pathname).toBe('/api/home2/hotUpdates')
        expect(ATSUMARU_HOME_SECTIONS.find(
            (section) => section.id === 'hot-updates'
        )?.badge).toBe('updated')
        expect(ATSUMARU_HOME_SECTIONS.find(
            (section) => section.id === 'recently-updated'
        )).toMatchObject({
            style: SectionStyle.SimpleDoubleRow,
            badge: 'updated'
        })

        const bookmarked = new URL(
            buildAtsumaruListRequest('most-bookmarked', 1).url
        )
        expect(bookmarked.searchParams.get('timeframe')).toBe('weekly')

        const trending = buildAtsumaruListRequest('trending', 2, 15)
        const trendingUrl = new URL(trending.url)
        expect(trending.kind).toBe('search')
        expect(trendingUrl.searchParams.get('sort_by')).toBe('trending:desc')
        expect(trendingUrl.searchParams.get('page')).toBe('2')
        expect(trendingUrl.searchParams.get('per_page')).toBe('15')
        expect(trendingUrl.searchParams.get('filter_by')).not.toContain('isAdult')
    })

    test('creates dynamic advanced filters and orderable sort options', () => {
        const form = createAtsumaruSearchForm({
            genres: [{ id: '1', name: 'Action' }],
            tags: [
                { id: '2', name: 'Magic', group: 'World Building' },
                { id: '3', name: 'Trauma', group: 'Themes' },
                { id: '4', name: 'Accidents', group: 'Themes' }
            ],
            types: [{ id: 'Manga', name: 'Manga' }],
            statuses: [{ id: 'Ongoing', name: 'Ongoing' }]
        })
        const genreSection = form.sections.find(
            (section) => section.type === SearchSectionType.LIST &&
                'children' in section &&
                section.children[0]?.id === 'genres'
        )
        const genreFields = genreSection && 'children' in genreSection
            ? genreSection.children
            : []
        const narrativeFields = genreFields.filter((field) => field.id.startsWith('t_'))
        expect(genreSection?.header).toBe('Genres & tags')
        expect(genreFields).toHaveLength(3)
        expect(narrativeFields).toHaveLength(2)
        expect(genreFields[0]?.type).toBe(FilterType.EXCLUDABLE_MULTISELECT)
        expect(genreFields[0] && 'presentation' in genreFields[0]
            ? genreFields[0].presentation
            : undefined).toBe('sheet')
        expect(narrativeFields.map((field) => field.title))
            .toEqual(['Themes', 'World Building'])
        expect(narrativeFields[0]?.options?.map((option) => option.title))
            .toEqual(['Accidents', 'Trauma'])
        expect(narrativeFields[1]?.options?.[0]?.title).toBe('Magic')
        expect(genreSection && 'groups' in genreSection
            ? genreSection.groups
            : []).toEqual([{
            id: 'tags',
            title: 'Tags',
            fieldIds: narrativeFields.map((field) => field.id)
        }])
        expect(narrativeFields.every((field) => /^t_[a-z0-9]{1,7}$/.test(field.id)))
            .toBe(true)
        expect(new Set(narrativeFields.map((field) => field.id)).size)
            .toBe(narrativeFields.length)
        expect(form.sections.filter(
            (section) => section.type === SearchSectionType.TAGS
        )).toHaveLength(2)

        const sorts = createAtsumaruSortOptions()
        expect(sorts).toHaveLength(6)
        expect(sorts.find((sort) => sort.isDefault)?.id).toBe('popularity')
        expect(sorts.every((sort) => sort.isOrderable)).toBe(true)
    })
})
