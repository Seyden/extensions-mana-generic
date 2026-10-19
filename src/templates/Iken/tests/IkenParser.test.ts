import {
    ContentType,
    PublicationStatus,
    ReadingMode,
    SectionStyle
} from '@mana-app/types'
import {
    buildIkenApiUrl,
    buildIkenSearchParameters
} from '../Iken'
import {
    IkenChapter,
    IkenFilterProps,
    IkenPost
} from '../IkenInterfaces'
import {
    formatIkenRelativeDate,
    IkenParser,
    mapIkenContentType,
    mapIkenPublicationStatus
} from '../IkenParser'

const FALLBACK_IMAGE = 'https://example.com/fallback.png'

const postFixture: IkenPost = {
    id: 605,
    postTitle: 'Kindergarten for Divine Beasts',
    postContent: '<p>A &amp; B story.</p><p>Second paragraph.</p>',
    alternativeTitles: 'Divine Beast Kindergarten',
    author: 'Author Name',
    artist: 'Artist Name',
    seriesType: 'MANHWA',
    seriesStatus: 'ONGOING',
    featuredImage: 'https://storage.example/cover.webp',
    genres: [{ id: 33, name: 'Webtoon' }],
    chapters: [
        {
            id: 32027,
            number: 75,
            createdAt: '2026-08-19T21:20:46.730Z',
            isLocked: true
        },
        {
            id: 32026,
            number: 74,
            createdAt: '2026-08-18T21:20:46.730Z',
            isLocked: false
        }
    ]
}

describe('Iken template', () => {
    const parser = new IkenParser()

    test('builds numeric-ID API requests without requiring a slug', () => {
        expect(buildIkenApiUrl('https://api.vortexscans.org', 'api/post', {
            postId: 605
        })).toBe('https://api.vortexscans.org/api/post?postId=605')

        expect(buildIkenApiUrl('https://api.vortexscans.org/', '/api/query', {
            page: 1,
            searchTerm: ''
        })).toBe('https://api.vortexscans.org/api/query?page=1&searchTerm=')
    })

    test('maps advanced Vortex filters to Iken query parameters', () => {
        expect(buildIkenSearchParameters({
            page: 2,
            query: 'swordsman',
            filters: {
                genres: {
                    included: [{ id: '1', title: 'Action' }],
                    excluded: [{ id: '14', title: 'Romance' }]
                },
                types: [
                    { id: 'MANGA', title: 'Manga' },
                    { id: 'MANHWA', title: 'Manhwa' }
                ],
                status: { id: 'ONGOING', title: 'Ongoing' },
                minimumChapters: 10,
                maximumChapters: 100,
                createdAfter: '2025-01-01',
                createdBefore: '2026-01-01'
            },
            sort: {
                id: 'updatedAt',
                ascending: true
            }
        }, 20)).toEqual({
            page: 2,
            perPage: 20,
            searchTerm: 'swordsman',
            genreIds: '1',
            excludedGenreIds: '14',
            seriesType: 'MANGA,MANHWA',
            seriesStatus: 'ONGOING',
            minChapters: 10,
            maxChapters: 100,
            createdAfter: '2025-01-01',
            createdBefore: '2026-01-01',
            orderBy: 'updatedAt',
            orderDirection: 'asc'
        })
    })

    test('accepts partially initialized genre filters', () => {
        expect(buildIkenSearchParameters({
            page: 1,
            filters: {
                genres: {
                    included: [{ id: '1', title: 'Action' }]
                } as unknown as IkenFilterProps['genres']
            }
        }, 20)).toEqual(expect.objectContaining({
            genreIds: '1',
            excludedGenreIds: undefined
        }))
    })

    test('maps search results with the latest locked chapter and no public URLs', () => {
        const results = parser.parseHighlights([
            postFixture,
            {
                id: 606,
                postTitle: 'A Novel',
                seriesType: 'NOVEL'
            }
        ], FALLBACK_IMAGE)

        expect(results).toEqual([expect.objectContaining({
            id: '605',
            title: postFixture.postTitle,
            subtitle: '🔒 Chapter 75'
        })])
        expect(results[0]?.webUrl).toBeUndefined()
    })

    test('maps grouped home highlights using Asura-style chapter details', () => {
        const results = parser.parseHighlights(
            [postFixture],
            FALLBACK_IMAGE,
            SectionStyle.DetailedVerticalListGrouped,
            Date.parse('2026-08-19T21:30:46.730Z')
        )

        expect(results[0]?.subtitle).toBeUndefined()
        expect(results[0]?.info).toEqual([
            {
                key: '🔒 Chapter 75',
                value: '10 minutes ago'
            },
            {
                key: 'Chapter 74',
                value: 'a day ago'
            }
        ])
    })

    test('formats home chapter dates as relative values', () => {
        const now = Date.parse('2026-08-19T12:00:00Z')

        expect(formatIkenRelativeDate('2026-08-19T11:59:31Z', now)).toBe('a few seconds ago')
        expect(formatIkenRelativeDate('2026-08-19T06:00:00Z', now)).toBe('6 hours ago')
        expect(formatIkenRelativeDate('2026-08-13T12:00:00Z', now)).toBe('6 days ago')
        expect(formatIkenRelativeDate(undefined, now)).toBe('')
    })

    test('maps title metadata and cleans HTML descriptions', () => {
        const content = parser.parseContent(postFixture, FALLBACK_IMAGE)

        expect(content).toMatchObject({
            title: postFixture.postTitle,
            cover: postFixture.featuredImage,
            status: PublicationStatus.ONGOING,
            contentType: ContentType.MANHWA,
            recommendedPanelMode: ReadingMode.WEBTOON,
            summary: 'A & B story.\nSecond paragraph.',
            additionalTitles: ['Divine Beast Kindergarten']
        })
        expect(content.tags).toEqual([{ id: '33', title: 'Webtoon' }])
        expect(content.additionalInfo?.[0]?.items).toHaveLength(2)
        expect(content.webUrl).toBeUndefined()
    })

    test.each([
        ['ONGOING', PublicationStatus.ONGOING],
        ['COMING_SOON', PublicationStatus.ONGOING],
        ['COMPLETED', PublicationStatus.COMPLETED],
        ['HIATUS', PublicationStatus.HIATUS],
        ['DROPPED', PublicationStatus.CANCELLED],
        ['CANCELLED', PublicationStatus.CANCELLED]
    ])('maps publication status %s', (input, expected) => {
        expect(mapIkenPublicationStatus(input)).toBe(expected)
    })

    test.each([
        ['MANGA', ContentType.MANGA],
        ['MANHUA', ContentType.MANHUA],
        ['MANHWA', ContentType.MANHWA],
        ['OTHER', ContentType.COMIC]
    ])('maps content type %s', (input, expected) => {
        expect(mapIkenContentType(input)).toBe(expected)
    })

    test('filters inaccessible chapters and sorts unlocked chapters oldest first', () => {
        const chapters: IkenChapter[] = [
            {
                id: 30,
                number: 3,
                createdAt: '2026-01-03T00:00:00Z'
            },
            {
                id: 20,
                number: '2',
                title: 'A title',
                createdAt: '2026-01-02T00:00:00Z'
            },
            { id: 40, number: 4, isLocked: true },
            { id: 50, number: 5, isTimeLocked: true },
            { id: 60, number: 6, isPermanentlyLocked: true },
            { id: 70, number: 7, isShortLinkLocked: true },
            { id: 80, number: 8, isAccessible: false },
            { id: 90, number: 9, price: 100, chapterPurchased: false }
        ]

        const result = parser.parseChapters(chapters, 'en_GB')

        expect(result.map((chapter) => chapter.chapterId)).toEqual(['20', '30'])
        expect(result.map((chapter) => chapter.index)).toEqual([0, 1])
        expect(result[0]).toMatchObject({
            title: 'Chapter 2 - A title'
        })
        expect(result[0]?.webUrl).toBeUndefined()
    })

    test('sorts pages by API order or filename and encodes spaces', () => {
        const chapter = {
            images: [
                { url: 'https://cdn.example/page-0010.webp', order: 2 },
                { url: 'https://cdn.example/page 0002.webp', order: 3 },
                { url: 'https://cdn.example/page-0001.webp', order: 1 }
            ]
        }

        expect(parser.parseChapterData(chapter, false).pages).toEqual([
            { url: 'https://cdn.example/page-0001.webp' },
            { url: 'https://cdn.example/page-0010.webp' },
            { url: 'https://cdn.example/page%200002.webp' }
        ])
        expect(parser.parseChapterData(chapter, true).pages).toEqual([
            { url: 'https://cdn.example/page-0001.webp' },
            { url: 'https://cdn.example/page%200002.webp' },
            { url: 'https://cdn.example/page-0010.webp' }
        ])
    })

    test('rejects locked and malformed chapter page responses', () => {
        expect(() => parser.parseChapterData({
            images: [{ url: 'https://cdn.example/page.webp' }],
            isLockedByCoins: true
        }, false)).toThrow('locked or inaccessible')

        expect(() => parser.parseChapterData({ images: [] }, false))
            .toThrow('No chapter pages')
    })
})
