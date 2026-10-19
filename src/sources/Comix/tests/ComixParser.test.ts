import {
    ContentRating,
    ContentType,
    PublicationStatus,
    ReadingMode
} from '@mana-app/types'
import {
    ComixManga,
    ComixPublicationStatus
} from '../ComixInterfaces'
import {
    ComixParser,
    mapComixContentRating,
    mapComixContentType,
    mapComixPublicationStatus,
    parseComixRelativeDate
} from '../ComixParser'
import { DEFAULT_COMIX_PREFERENCES } from '../ComixPreferences'

const mangaFixture: ComixManga = {
    id: 16429,
    hid: 'nn7xe',
    title: 'My Disciples Are All Big Villains',
    altTitles: ['My Disciples Are All Villains'],
    type: 'manhua',
    status: 'releasing',
    originalLanguage: 'zh',
    poster: {
        medium: 'https://static.comix.to/cover@280.jpg',
        large: 'https://static.comix.to/cover.jpg'
    },
    synopsis: 'A synopsis.',
    contentRating: 'suggestive',
    url: '/title/nn7xe-my-disciples-are-all-big-villains',
    genres: [{ id: 6, title: 'Action' }],
    formats: [{ id: 93170, title: 'Long Strip' }],
    authors: [{ id: 1, title: 'Author Name' }],
    artists: [{ id: 2, title: 'Artist Name' }],
    links: {
        al: 'https://anilist.co/manga/160564/',
        mal: 'https://myanimelist.net/manga/12345/'
    }
}

describe('ComixParser', () => {
    const parser = new ComixParser()

    test('maps complete title metadata into Mana content', () => {
        const content = parser.parseContent(mangaFixture)

        expect(content.title).toBe(mangaFixture.title)
        expect(content.cover).toBe(mangaFixture.poster?.large)
        expect(content.status).toBe(PublicationStatus.ONGOING)
        expect(content.contentType).toBe(ContentType.MANHUA)
        expect(content.contentRating).toBe(ContentRating.SUGGESTIVE)
        expect(content.recommendedPanelMode).toBe(ReadingMode.WEBTOON)
        expect(content.additionalTitles).toEqual(mangaFixture.altTitles)
        expect(content.tags).toEqual(expect.arrayContaining([
            expect.objectContaining({ title: 'Action' }),
            expect.objectContaining({ title: 'Long Strip' })
        ]))
        expect(content.trackerInfo).toEqual({
            anilist: '160564',
            mal: '12345'
        })
        expect(content.additionalInfo).toHaveLength(2)
    })

    test.each<[ComixPublicationStatus, PublicationStatus]>([
        ['releasing', PublicationStatus.ONGOING],
        ['not_yet_released', PublicationStatus.ONGOING],
        ['finished', PublicationStatus.COMPLETED],
        ['on_hiatus', PublicationStatus.HIATUS],
        ['discontinued', PublicationStatus.CANCELLED]
    ])('maps status %s', (input, expected) => {
        expect(mapComixPublicationStatus(input)).toBe(expected)
    })

    test('maps every Comix content rating', () => {
        expect(mapComixContentRating('safe')).toBe(ContentRating.SAFE)
        expect(mapComixContentRating('suggestive')).toBe(ContentRating.SUGGESTIVE)
        expect(mapComixContentRating('erotica')).toBe(ContentRating.MATURE)
        expect(mapComixContentRating('pornographic')).toBe(ContentRating.EXPLICIT)
    })

    test.each([
        ['manga', ContentType.MANGA],
        ['manhwa', ContentType.MANHWA],
        ['manhua', ContentType.MANHUA],
        ['other', ContentType.COMIC]
    ] as const)('maps content type %s', (input, expected) => {
        expect(mapComixContentType(input)).toBe(expected)
    })

    test('handles a title with all optional fields missing', () => {
        const content = parser.parseContent({
            hid: 'minimal',
            title: 'Minimal Title'
        })

        expect(content.title).toBe('Minimal Title')
        expect(content.cover).toContain('comix.to')
        expect(content.additionalTitles).toEqual([])
        expect(content.tags).toEqual([])
        expect(content.additionalInfo).toBeUndefined()
        expect(content.trackerInfo).toBeUndefined()
    })

    test('preserves duplicate chapter releases and sorts oldest first', () => {
        const chapters = parser.parseChapters([
            {
                id: 30,
                number: 2,
                createdAt: '2026-01-03T00:00:00Z',
                group: { id: 7, name: 'Group B' },
                url: '/title/series/30-chapter-2'
            },
            {
                id: 10,
                number: 1,
                createdAt: '2026-01-01T00:00:00Z',
                group: { id: 6, name: 'Group A' },
                url: '/title/series/10-chapter-1'
            },
            {
                id: 20,
                number: 2,
                createdAt: '2026-01-02T00:00:00Z',
                isOfficial: true,
                url: '/title/series/20-chapter-2'
            }
        ], 'series')

        expect(chapters.map((chapter) => chapter.chapterId)).toEqual(['10', '20', '30'])
        expect(chapters.map((chapter) => chapter.index)).toEqual([0, 1, 2])
        expect(chapters[0]?.provider).toEqual({ id: '6', name: 'Group A' })
        expect(chapters[1]?.provider).toEqual({ id: 'official', name: 'Official' })
        expect(chapters[2]?.provider).toEqual({ id: '7', name: 'Group B' })
    })

    test('deduplicates preferred releases and applies the scanlator blacklist', () => {
        const chapters = parser.parseChapters([
            {
                id: 10,
                number: 1,
                votes: 100,
                group: { id: 6, name: 'Blocked Group' }
            },
            {
                id: 20,
                number: 2,
                votes: 200,
                group: { id: 7, name: 'Popular Group' }
            },
            {
                id: 30,
                number: 2,
                votes: 1,
                isOfficial: true
            },
            {
                id: 40,
                number: 3,
                votes: 5,
                group: { id: 10702, name: 'Preferred Group' }
            },
            {
                id: 50,
                number: 3,
                votes: 500,
                group: { id: 8, name: 'Other Group' }
            }
        ], 'series', {
            ...DEFAULT_COMIX_PREFERENCES,
            deduplicateChapters: true,
            scanlatorBlacklist: 'blocked group'
        })

        expect(chapters.map((chapter) => chapter.chapterId)).toEqual(['30', '40'])
        expect(chapters[0]?.provider).toEqual({ id: 'official', name: 'Official' })
        expect(chapters[1]?.provider).toEqual({ id: '10702', name: 'Preferred Group' })
    })

    test('parses relative dates deterministically', () => {
        const now = Date.parse('2026-07-28T12:00:00Z')

        expect(parseComixRelativeDate('6h ago', now).toISOString())
            .toBe('2026-07-28T06:00:00.000Z')
        expect(parseComixRelativeDate('2mo ago', now).toISOString())
            .toBe('2026-05-29T12:00:00.000Z')
        expect(parseComixRelativeDate('2 days ago', now).toISOString())
            .toBe('2026-07-26T12:00:00.000Z')
        expect(parseComixRelativeDate('3 months', now).toISOString())
            .toBe('2026-04-29T12:00:00.000Z')
        expect(parseComixRelativeDate(undefined, now).getTime()).toBe(0)
    })

    test('prefers absolute chapter dates and falls back to formatted relative dates', () => {
        const chapters = parser.parseChapters([
            {
                id: 1,
                number: 1,
                createdAt: 'not-a-date',
                createdAtFormatted: '2d ago'
            }
        ], 'series')

        expect(chapters[0]?.date.getTime()).toBeGreaterThan(0)
    })

    test('accepts URL and decoded raw reader pages', () => {
        const data = parser.parseChapterData([
            { url: 'https://cdn.example/page-1.webp' },
            { raw: 'YmFzZTY0' }
        ], 'series', 'chapter')

        expect(data.pages).toEqual([
            { url: 'https://cdn.example/page-1.webp' },
            { raw: 'YmFzZTY0' }
        ])
    })

    test('converts pagination metadata', () => {
        const firstPage = parser.parsePagedResults({
            items: [mangaFixture],
            meta: {
                page: 2,
                lastPage: 3,
                hasNext: true,
                total: 75
            }
        })
        const lastPage = parser.parsePagedResults({
            items: [mangaFixture],
            meta: {
                page: 3,
                lastPage: 3,
                hasNext: false,
                total: 75
            }
        })

        expect(firstPage).toEqual(expect.objectContaining({
            isLastPage: false,
            totalResultCount: 75
        }))
        expect(lastPage.isLastPage).toBe(true)
    })

    test('applies title presentation preferences', () => {
        const content = parser.parseContent({
            ...mangaFixture,
            poster: {
                small: 'https://static.comix.to/small.jpg',
                medium: 'https://static.comix.to/medium.jpg',
                large: 'https://static.comix.to/large.jpg'
            },
            year: 2025,
            ratedAvg: 8.5,
            ratedCount: 25,
            followsTotal: 100,
            tags: [{ id: 99, title: 'Time Travel' }]
        }, {
            ...DEFAULT_COMIX_PREFERENCES,
            posterQuality: 'small',
            showAlternativeTitlesInSummary: true,
            showNarrativeTags: true,
            scorePosition: 'bottom'
        })

        expect(content.cover).toBe('https://static.comix.to/small.jpg')
        expect(content.summary).toContain('Alternative names:')
        expect(content.summary).toContain('Year: 2025')
        expect(content.summary).toContain('★★★★☆ 8.5/10')
        expect(content.tags).toEqual(expect.arrayContaining([
            expect.objectContaining({ title: 'Time Travel' })
        ]))
    })
})
