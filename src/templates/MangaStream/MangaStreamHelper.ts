import {
    PageSection,
    SectionStyle,
    Option
} from '@mana-app/types'

export interface HomeSectionData {
    selectorFunc: Function
    titleSelectorFunc: Function
    subtitleSelectorFunc: Function
    getViewMoreItemsFunc: Function
    section: PageSection
    enabled: boolean
    sortIndex: number
}

export const DefaultHomeSectionData = {
    titleSelectorFunc: ($: CheerioStatic, element: CheerioElement) => $('h2', element).text().trim(),
    subtitleSelectorFunc: () => undefined,
    getViewMoreItemsFunc: () => undefined,
    enabled: true
}

export function createHomeSection(id: string, title: string, containsMoreItems: boolean = true, style: SectionStyle = SectionStyle.SimpleSingleRow): PageSection {
    return {
        id,
        title,
        style,
        viewMoreLink: containsMoreItems ? { request: { page: 1, listId: id } } : undefined,
    }
}

export function getSelectValue(filterValue: Option | undefined): any {
    return filterValue?.id?.replace(' ', '+')
}

export function getIncludedTagBySection(section: string, tags: Option[]): any {
    return (tags?.find((x: Option) => x.id.startsWith(`${section}:`))?.id.replace(`${section}:`, '') ?? '').replace(' ', '+')
}

export function getFilterTagsBySection(tags: Option[], included: boolean, supportsExclusion: boolean = false): string[] {
    if (!included && !supportsExclusion) {
        return []
    }

    return tags?.map((x: Option) => {
        let id: string = x.id
        if (!included) {
            id = encodeURI(`-${id}`)
        }
        return id
    })
}

export function isImgLink(url: string) {
    return(url.match(/^http[^\?]*.(jpg|jpeg|gif|png|tiff|bmp)(\?(.*))?$/gmi) != null);
}