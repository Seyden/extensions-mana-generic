import {
    NetworkRequest,
    NetworkResponse,
    Tag,
    Option
} from '@mana-app/types'

export function getSelectValue(filterValue: Option | undefined): any {
    return filterValue?.id?.replace(' ', '+')
}

export function getIncludedTagBySection(section: string, tags: Tag[]): any {
    return (tags?.find((x: Tag) => x.id.startsWith(`${section}:`))?.id.replace(`${section}:`, '') ?? '').replace(' ', '+')
}

export function getFilterTagsBySection(section: string, tags: Tag[]): string[] {
    return tags?.filter((x: Tag) => x.id.startsWith(`${section}:`)).map((x: Tag) => {
        return x.id.replace(`${section}:`, '')
    })
}

export function isImgLink(url: string) {
    return(url.match(/^http[^\?]*.(jpg|jpeg|gif|png|tiff|bmp)(\?(.*))?$/gmi) != null);
}

export async function getMangaSlug(mangaId: string): Promise<string | null> {
    return await ObjectStore.string(`${mangaId}:slug`)
}

export async function setMangaSlug(mangaId: string, link: string): Promise<void> {
    await ObjectStore.set(`${mangaId}:slug`, link)
}

export async function loadRequestData(client: NetworkClient, url: string, method: string = 'GET'): Promise<string> {
    const request: NetworkRequest = {
        url,
        method,
        validateStatus: s => s == 404 || s == 403 || s == 503 || (s >= 200 && s < 300)
    }

    const response = await client.request(request)
    checkResponseErrors(response)
    return response.data as string
}

export async function loadJsonData<T extends object>(client: NetworkClient, url: string, method: string = 'GET'): Promise<T> {
    const data = await loadRequestData(client, url, method)
    try {
        return JSON.parse(data) as T
    } catch {
        throw new Error(`Invalid AsuraScans JSON response: ${url}`)
    }
}

export function checkResponseErrors(response: NetworkResponse): void {
    const status = response.status
    switch (status) {
    case 403:
    case 503:
        throw new CloudflareError(response.request.url)
    case 404:
        throw new Error(`The requested page ${response.request.url} was not found!`)
    }
}
