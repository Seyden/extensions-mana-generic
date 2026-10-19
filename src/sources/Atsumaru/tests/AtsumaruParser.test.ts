import {
    AdditionalInfoType,
    ContentRating,
    ContentType,
    PublicationStatus,
    ReadingMode,
    SimpleHighlight
} from '@mana-app/types'
import {
    AtsumaruParser,
    formatAtsumaruRelativeTime,
    mapAtsumaruContentRating,
    mapAtsumaruContentType,
    mapAtsumaruStatus,
    normalizeAtsumaruAssetUrl
} from '../AtsumaruParser'
import { AtsumaruManga } from '../AtsumaruTypes'

const mangaFixture: AtsumaruManga = {
    id: 'series-id',
    title: 'Example Manga',
    englishTitle: 'Example Manga English',
    otherNames: ['Example Manga', 'Alternative Name'],
    poster: {
        image: 'posters/cover.jpg',
        mediumImage: '/static/posters/cover-medium.avif',
        largeImage: 'posters/cover-large.avif'
    },
    type: 'Manwha',
    status: 'Ongoing',
    synopsis: 'A synopsis.',
    released: 1_704_067_200_000,
    views: '1.2M',
    avgRating: 8.5,
    mbContentRating: 'Erotica',
    genres: [
        { id: '1', name: 'Action' },
        { id: '2', name: 'Fantasy' }
    ],
    tags: [
        { id: '10', name: 'Magic', namePath: 'World Building > Magic', weight: 'Core' },
        { id: '11', name: 'Castle', namePath: 'Locations > Castle', weight: 'Incidental' },
        { id: '12', name: '3D Art', namePath: 'Work Info > Art Style > 3D Art' },
        { id: '13', name: '#Special' }
    ],
    authors: [
        { id: 'author', name: 'Author Name', type: 'Author' },
        { id: 'artist', name: 'Artist Name', type: 'Artist' }
    ],
    anilistId: '100',
    malId: '200',
    kitsuId: '300',
    mangaUpdatesId: 'series-slug',
    annId: '400',
    kenmeiUrl: 'https://www.kenmei.co/series/example',
    relations: [
        {
            type: 'Sequel',
            manga: {
                id: 'related-one',
                title: 'Related One',
                image: 'posters/related-one.jpg'
            }
        }
    ],
    recommendations: [
        {
            id: 'related-one',
            title: 'Related One Duplicate',
            image: 'posters/duplicate.jpg'
        },
        {
            id: 'related-two',
            title: 'Related Two',
            image: 'posters/related-two.jpg',
            isAdult: true
        }
    ],
    similarManga: [
        {
            id: 'series-id',
            title: 'Self',
            image: 'posters/self.jpg'
        }
    ]
}

describe('AtsumaruParser', () => {
    const parser = new AtsumaruParser()

    test('maps rich title metadata and keeps narrative tags in Details', () => {
        const content = parser.parseContent(mangaFixture)

        expect(content.title).toBe('Example Manga')
        expect(content.cover).toBe('https://cdn.atsu.moe/static/posters/cover-large.avif')
        expect(content.status).toBe(PublicationStatus.ONGOING)
        expect(content.contentType).toBe(ContentType.MANHWA)
        expect(content.contentRating).toBe(ContentRating.MATURE)
        expect(content.recommendedPanelMode).toBe(ReadingMode.WEBTOON)
        expect(content.additionalTitles).toEqual([
            'Example Manga English',
            'Alternative Name'
        ])
        expect(content.tags).toEqual([
            { id: '1', title: 'Action' },
            { id: '2', title: 'Fantasy' }
        ])
        expect(content.summary).toContain('Rating: 8.50/10')
        expect(content.summary).toContain('Year: 2024')
        expect(content.trackerInfo).toEqual({ anilist: '100', mal: '200' })
        expect(content.webUrl).toBeUndefined()
        const highlight = parser.parseHighlight(mangaFixture)
        expect(highlight.webUrl).toBeUndefined()
        expect(highlight.subtitle).toBeUndefined()
        expect(highlight.badge).toEqual({ text: '★ 8.5' })

        expect(parser.parseHighlight({
            id: 'adult',
            title: 'Adult title',
            avgRating: 7.25,
            isAdult: true
        }).badge).toEqual({ text: '★ 7.25 | 18+' })
        expect(parser.parseHighlight({
            id: 'unrated-adult',
            title: 'Unrated adult title',
            mbContentRating: 'Pornographic'
        }).badge).toEqual({ text: '18+' })

        const tagSections = content.additionalInfo?.filter(
            (section) => section.type === AdditionalInfoType.Tags
        )
        expect(tagSections?.map((section) => ({
            title: section.title,
            items: section.items.map((item) => item.title)
        }))).toEqual([
            { title: 'Locations', items: ['Castle'] },
            { title: 'Work Info', items: ['3D Art'] },
            { title: 'World Building', items: ['Magic'] },
            { title: 'Other', items: ['#Special'] }
        ])

        const relatedSection = content.additionalInfo?.find(
            (section) => section.type === AdditionalInfoType.Highlights
        )
        expect(relatedSection?.items.map((item) => item.id)).toEqual([
            'related-one',
            'related-two'
        ])
        const relatedItems = relatedSection?.items as SimpleHighlight[] | undefined
        expect(relatedItems?.[1]?.contentRating)
            .toBe(ContentRating.EXPLICIT)
        expect(relatedItems?.every((item) => !item.webUrl)).toBe(true)

        const staffSection = content.additionalInfo?.find(
            (section) => section.type === AdditionalInfoType.Staff
        )
        expect(staffSection?.items).toHaveLength(2)

        const linkSection = content.additionalInfo?.find(
            (section) => section.type === AdditionalInfoType.Links
        )
        expect(linkSection?.items).toHaveLength(6)
    })

    test('maps ratings, types, statuses, and adult fallback', () => {
        expect(mapAtsumaruContentRating('Safe')).toBe(ContentRating.SAFE)
        expect(mapAtsumaruContentRating('Suggestive')).toBe(ContentRating.SUGGESTIVE)
        expect(mapAtsumaruContentRating('Erotica')).toBe(ContentRating.MATURE)
        expect(mapAtsumaruContentRating('Pornographic')).toBe(ContentRating.EXPLICIT)
        expect(mapAtsumaruContentRating(undefined, true)).toBe(ContentRating.EXPLICIT)
        expect(mapAtsumaruContentType('Manga')).toBe(ContentType.MANGA)
        expect(mapAtsumaruContentType('Manhua')).toBe(ContentType.MANHUA)
        expect(mapAtsumaruContentType('OEL')).toBe(ContentType.COMIC)
        expect(mapAtsumaruStatus('Completed')).toBe(PublicationStatus.COMPLETED)
        expect(mapAtsumaruStatus('Hiatus')).toBe(PublicationStatus.HIATUS)
        expect(mapAtsumaruStatus('Canceled')).toBe(PublicationStatus.CANCELLED)
    })

    test('formats update badges like the Atsumaru website', () => {
        const now = 1_788_101_200_000
        expect(formatAtsumaruRelativeTime(now - 3_000, now)).toBe('just now')
        expect(formatAtsumaruRelativeTime(now - 8 * 60_000, now)).toBe('8m ago')
        expect(formatAtsumaruRelativeTime(now - 3 * 3_600_000, now)).toBe('3h ago')
        expect(formatAtsumaruRelativeTime(now + 2 * 86_400_000, now)).toBe('in 2d')
        expect(formatAtsumaruRelativeTime('invalid', now)).toBeUndefined()

        jest.spyOn(Date, 'now').mockReturnValue(now)
        const highlight = parser.parseHighlight({
            id: 'updated',
            title: 'Updated title',
            type: 'Manga',
            updatedAt: now - 8 * 60_000
        }, 'updated')
        expect(highlight.badge).toEqual({ text: '8m ago' })
        expect(highlight.subtitle).toBeUndefined()
        jest.restoreAllMocks()
    })

    test('normalizes all supported image URL forms to HTTPS', () => {
        expect(normalizeAtsumaruAssetUrl('pages/image.avif'))
            .toBe('https://cdn.atsu.moe/static/pages/image.avif')
        expect(normalizeAtsumaruAssetUrl('/static/pages/image.avif'))
            .toBe('https://cdn.atsu.moe/static/pages/image.avif')
        expect(normalizeAtsumaruAssetUrl(
            'https://atsu.moe/static/pages/image.avif'
        )).toBe('https://cdn.atsu.moe/static/pages/image.avif')
        expect(normalizeAtsumaruAssetUrl(
            'https://cdn.atsu.moe/static/pages/image.avif'
        )).toBe('https://cdn.atsu.moe/static/pages/image.avif')
        expect(normalizeAtsumaruAssetUrl('//cdn.example/image.jpg'))
            .toBe('https://cdn.example/image.jpg')
        expect(normalizeAtsumaruAssetUrl('http://cdn.example/image.jpg'))
            .toBe('https://cdn.example/image.jpg')
    })

    test('uses optimized poster fields returned by search before the original poster', () => {
        const highlight = parser.parseHighlight({
            id: 'search-result',
            title: 'Search result',
            poster: '/static/posters/cover.jpg',
            posterMedium: '/static/posters/cover-medium.avif',
            posterSmall: '/static/posters/cover-small.avif'
        })

        expect(highlight.cover).toBe(
            'https://cdn.atsu.moe/static/posters/cover-medium.avif'
        )
    })

    test('preserves duplicate releases and assigns providers and stable indices', () => {
        const chapters = parser.parseChapters([
            {
                id: 'group-b-late',
                number: 2,
                title: 'Chapter 2',
                createdAt: 1_704_240_000_000,
                scanlationMangaId: 'group-b'
            },
            {
                id: 'group-a',
                number: 1,
                title: 'Chapter 1',
                createdAt: '2024-01-01T00:00:00Z',
                scanlationMangaId: 'group-a'
            },
            {
                id: 'group-b-early',
                number: 2,
                title: 'Chapter 2',
                createdAt: '1704153600',
                scanlationMangaId: 'group-b'
            }
        ], [
            { id: 'group-a', name: 'Alpha' },
            { id: 'group-b', name: 'Beta' }
        ], 'series-id')

        expect(chapters.map((chapter) => chapter.chapterId)).toEqual([
            'group-a',
            'group-b-early',
            'group-b-late'
        ])
        expect(chapters.map((chapter) => chapter.index)).toEqual([0, 1, 2])
        expect(chapters.map((chapter) => chapter.provider?.name)).toEqual([
            'Alpha',
            'Beta',
            'Beta'
        ])
        expect(chapters.every((chapter) => !chapter.webUrl)).toBe(true)
    })

    test('preserves page order and rejects an empty reader response', () => {
        expect(parser.parseChapterData([
            { image: '/static/pages/one.avif' },
            { image: 'https://cdn.example/two.jpg' }
        ], 'series-id', 'chapter-id').pages).toEqual([
            { url: 'https://cdn.atsu.moe/static/pages/one.avif' },
            { url: 'https://cdn.example/two.jpg' }
        ])

        expect(() => parser.parseChapterData([], 'series-id', 'chapter-id'))
            .toThrow('Atsumaru returned no pages for series-id/chapter-id')
    })
})
