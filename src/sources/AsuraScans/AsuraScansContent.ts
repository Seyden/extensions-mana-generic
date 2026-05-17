import { Chapter, ChapterData, Content } from '@mana-app/types'
import { ChapterDetailResponse, SeriesChapter, SeriesDetail } from './AsuraScansInterfaces'
import { loadJsonData } from './AsuraScansHelper'
import { ASURASCANS_API_DOMAIN } from './AsuraScansInfo'
import { AsuraScansParser } from './AsuraScansParser'

export async function getContent(client: NetworkClient, parser: AsuraScansParser, mangaId: string, source: any): Promise<Content> {
    const data = await loadJsonData<{ series?: SeriesDetail }>(client, `${ASURASCANS_API_DOMAIN}/api/series/${mangaId}`)
    return parser.parseMangaDetails(data, mangaId, source)
}

export async function getChapters(client: NetworkClient, parser: AsuraScansParser, mangaId: string, source: any): Promise<Chapter[]> {
    const { data: chapters } = await loadJsonData<{ data?: SeriesChapter[] }>(client, `${ASURASCANS_API_DOMAIN}/api/series/${mangaId}/chapters`)
    return parser.parseChapterList(chapters ?? [], mangaId, source)
}

export async function getChapterData(client: NetworkClient, parser: AsuraScansParser, mangaId: string, chapterId: string, chapter?: Chapter): Promise<ChapterData> {
    const chapterLink = chapter?.number.toString() ?? ''
    if (!chapterLink) {
        throw new Error(`Could not get Chapter Data for mangaId: ${mangaId} chapterId: ${chapterId} because the webUrl was empty!`)
    }

    const { data: { chapter: chapterDetail } = {} } = await loadJsonData<ChapterDetailResponse>(client, `${ASURASCANS_API_DOMAIN}/api/series/${mangaId}/chapters/${chapterLink}`)
    return parser.parseChapterDetails(chapterDetail, mangaId)
}
