import {
    HttpClient,
    CloudflareError,
    HttpResponse,
    Tag,
    Option,
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

export async function loadJsonData<T>(client: HttpClient, url: string): Promise<T> {
    const response = await client.get(url)
    checkResponseErrors(response)
    return response.json<T>()
}

export function checkResponseErrors(response: HttpResponse): void {
    const status = response.status
    switch (status) {
        case 403:
        case 503:
            throw new CloudflareError(response.request.url)
        case 404:
            throw new Error(`The requested page ${response.request.url} was not found!`)
    }

    response.requireOk()
}
