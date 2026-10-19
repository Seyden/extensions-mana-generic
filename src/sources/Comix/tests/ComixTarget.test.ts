import { createComixImageHeaders } from '../ComixImageRequest'

describe('Comix target', () => {
    test.each([
        'https://8pl.andrewsnotes.site/hi/example',
        'https://80pd.wowpic1.store/i5/example',
        'https://comix.to.example.org/image.webp'
    ])('omits Referer and Origin from external reader images: %s', (url) => {
        const headers = createComixImageHeaders(url)

        expect(headers).not.toHaveProperty('Referer')
        expect(headers).not.toHaveProperty('Origin')
    })

    test('retains Referer for Comix cover assets', () => {
        const headers = createComixImageHeaders(
            'https://static.comix.to/cover.jpg'
        )

        expect(headers).toMatchObject({
            Referer: 'https://comix.to/'
        })
        expect(headers).not.toHaveProperty('Origin')
    })
})
