import {
    Chapter,
    ChapterData,
    Content,
    Highlight,
    PagedResult,
    Property,
    PublicationStatus,
    Tag
} from '@suwatte/daisuke'

import moment from 'moment/min/moment-with-locales'

export class WebtoonParser {

    constructor(
        private dateFormat: string,
        private language: string,
        private BASE_URL: string,
        private MOBILE_URL: string)
    { }

    parseDetails($: CheerioSelector, mangaId: string): Content {
        const detailElement = $('#content > div.cont_box > div.detail_header > div.info')
        const infoElement = $('#_asideDetail')

        const [image, title] = mangaId.startsWith('canvas')
                               ? [this.parseCanvasDetailsThumbnail($), detailElement.find('h3').text().trim()]
                               : [this.parseDetailsThumbnail($), detailElement.find('h1').text().trim()]

        const author = detailElement.find('.author_area').text().trim()

        const properties: Property[] = [
            {
                id: "genres",
                title: "Genres",
                tags: detailElement.find('.genre').toArray().map(genre => ({ id: $(genre).text(), title: $(genre).text() }))
            },
            ... author != '' ? [{
                id: "creators",
                title: "Credits",
                tags: [
                    ... author != '' ? [{
                        title: author,
                        id: `author-${author}`,
                        noninteractive: true
                    }] : []
                ],
            }] : []
        ]

        return {
            title: title,
            properties,
            summary: infoElement.find('p.summary').text(),
            status: this.parseStatus(infoElement),
            cover: image,
        }
    }

    parseStatus(infoElement: Cheerio): PublicationStatus {
        const statusElement = infoElement.find('p.day_info')
        const iconClass = statusElement.find('span').attr('class') ?? ''
        switch (iconClass) {
            case 'txt_ico_up':
            case 'txt_ico_up2':
            case 'txt_ico_new':
            case 'txt_ico_new2':
            case 'txt_ico_hot':
            case 'txt_ico_hot2':
                return PublicationStatus.ONGOING
            case 'txt_ico_completed':
            case 'txt_ico_completed2':
                return PublicationStatus.COMPLETED
            case 'txt_ico_hiatus':
            case 'txt_ico_hiatus2':
                return PublicationStatus.HIATUS
            default:
                return PublicationStatus.ONGOING
        }
    }

    parseDetailsThumbnail($: CheerioSelector): string {
        return $('#content > div.cont_box > div.detail_body').attr('style')?.match(/url\((.*?)\)/)?.[1] ?? ''
    }

    parseCanvasDetailsThumbnail($: CheerioSelector): string {
        return $('#content > div.cont_box span.thmb > img').attr('src') ?? ''
    }

    parseChaptersList($: CheerioSelector): Chapter[] {
        let sortingIndex = 0

        return $('ul#_episodeList > li[id*=episode]')
            .toArray()
            .map(elem => ({
                chapterId: $('a', elem).attr('href')?.replace(this.MOBILE_URL + '/', '') ?? '',
                    title: $('a > div.row > div.info > p.sub_title > span.ellipsis', elem).text(),
                    number: Number($('a > div.row > div.num', elem).text()?.substring(1)),
                    date: this.parseDate($('a > div.row > div.info > div.sub_info > span.date', elem).text()),
                    index: sortingIndex++,
                    language: this.language
            }))
    }

    parseDate(date: string) : Date{
        return new Date(moment(date, this.dateFormat, this.language).toDate())
    }

    parseChapterDetails($: CheerioSelector, mangaId: string, chapterId: string): ChapterData {
        return {
            pages: $('div#_imageList img').toArray().map(elem => ({ url: $(elem).attr('data-url') ?? ''}))
        }
    }

    parsePopularTitles($: CheerioSelector): Highlight[] {
        return $('div#content div.NE\\=a\\:tnt li a')
            .toArray()
            .filter(elem => $(elem).find('p.subj'))
            .map(elem => this.parseMangaFromElement($(elem)))
    }

    parseTodayTitles($: CheerioSelector, allTitles: boolean): Highlight[] {
        const mangas: Highlight[] = []

        const date = moment().locale('en').format('dddd').toUpperCase()
        const list = $(`div#dailyList div.daily_section._list_${date} li a.daily_card_item`)
        for(let i = 0; i <= list.length && (allTitles || mangas.length < 10); i++){
            if($(list[i]).find('p.subj'))
                mangas.push(this.parseMangaFromElement($(list[i])))
        }

        return mangas
    }

    parseOngoingTitles($: CheerioSelector, allTitles: boolean): Highlight[] {
        const mangas: Highlight[] = []
        let maxChild = 0

        $('div#dailyList > div').each((_ : number, elem: CheerioElement) => {
            if ($(elem).find('li').length > maxChild) maxChild = $(elem).find('li').length
        })

        for (let i = 1; i <= maxChild; i++) {
            if(!allTitles && mangas.length >= 14) return mangas
            $('div#dailyList > div li:nth-child(' + i + ') a.daily_card_item').each((_ : number, elem: CheerioElement) => {
                if ($(elem).find('p.subj'))
                    mangas.push(this.parseMangaFromElement($(elem)))
            })
        }

        return mangas
    }

    parseCompletedTitles($: CheerioSelector, allTitles: boolean): Highlight[] {
        const mangas: Highlight[] = []

        const list = $('div.daily_lst.comp li a')
        for(let i = 0; i <= list.length && (allTitles || mangas.length < 10); i++){
            if($(list[i]).find('p.subj'))
                mangas.push(this.parseMangaFromElement($(list[i])))
        }

        return mangas
    }

    parseCanvasRecommendedTitles($: CheerioSelector): Highlight[] {
        return $('#recommendArea li.rolling-item')
            .toArray()
            .map(elem => this.parseCanvasFromRecommendedElement($(elem)))
    }

    parseCanvasFromRecommendedElement(elem: Cheerio): Highlight {
        return {
            id: elem.find('a').attr('href')?.replace(this.BASE_URL + '/', '') ?? '',
            title: elem.find('p.subj').text(),
            cover: elem.find('img').attr('src') ?? '',
            subtitle: 'Canvas'
        }
    }

    parseCanvasPopularTitles($: CheerioSelector): Highlight[] {
        return $('div.challenge_lst li a')
            .toArray()
            .map(elem => this.parseCanvasFromElement($(elem)))
    }

    parseMangaFromElement(elem: Cheerio): Highlight {
        return {
            id: elem.attr('href')?.replace(this.BASE_URL + '/', '') ?? '',
            title: elem.find('p.subj').text(),
            cover: elem.find('img').attr('src') ?? ''
        }
    }

    parseCanvasFromElement(elem: Cheerio): Highlight {
        return {
            id: elem.attr('href')?.replace(this.BASE_URL + '/', '') ?? '',
            title: elem.find('p.subj').text(),
            cover: elem.find('img').attr('src') ?? '',
            subtitle: 'Canvas'
        }
    }

    parseSearchResults($: CheerioSelector, canvas_wanted: boolean): PagedResult {
        const items: Highlight[] = []
        const test = $('#content > div.card_wrap.search li a.card_item')
            .toArray()

        items.push(...test
            .map(elem => this.parseMangaFromElement($(elem))))

        if (canvas_wanted) {
            items.push(...$('#content > div.card_wrap.search li a.challenge_item')
                .toArray()
                .map(elem => this.parseCanvasFromElement($(elem))))
        }

        return {
            results: items,
            isLastPage: items.length == 0
        }
    }

    parseGenres($: CheerioSelector): Tag[] {
        return  $('#content ul._genre li')
            .toArray()
            .map(elem => this.parseTagFromElement($(elem)))
    }

    parseCanvasGenres($: CheerioSelector): Tag[] {
        return $('#content ul.challenge li')
            .toArray()
            .filter(elem => $(elem).attr('data-genre') && $(elem).attr('data-genre') !== 'ALL')
            .map(elem => this.parseTagFromElement($(elem)))
    }

    parseTagFromElement(elem: Cheerio): Tag {
        return {
            id: elem.attr('data-genre') ?? '',
            title: elem.find('a').text().trim()
        }
    }

    parseTagResults($: CheerioSelector): PagedResult {
        let items = $('#content > div.card_wrap ul.card_lst li a')
            .toArray()
            .map(elem => this.parseMangaFromElement($(elem)))
        return {
            results: items,
            isLastPage: items.length == 0
        }
    }

}