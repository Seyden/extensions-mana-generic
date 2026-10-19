import { AtsumaruTaxonomyItem } from './AtsumaruTypes'

interface AtsumaruTagGroup {
    id: string
    title: string
    tags: Array<{ id: string; name: string }>
}

function categoryId(title: string): string {
    let hash = 0
    for (let index = 0; index < title.length; index++) {
        hash = (Math.imul(hash, 31) + title.charCodeAt(index)) >>> 0
    }
    return hash.toString(36)
}

export function groupAtsumaruTags(
    values: Array<string | AtsumaruTaxonomyItem> | null | undefined
): AtsumaruTagGroup[] {
    const groups = new Map<string, AtsumaruTagGroup['tags']>()
    const seen = new Set<string>()

    for (const value of values ?? []) {
        const name = typeof value === 'string' ? value.trim() : value.name?.trim()
        if (!name) continue
        const id = typeof value === 'string' ? name : value.id || name
        if (seen.has(id)) continue
        seen.add(id)

        const category = typeof value === 'string' ? undefined :
            value.group?.trim() || (value.namePath?.includes('>')
                ? value.namePath.split('>')[0]?.trim()
                : undefined)
        const title = category || 'Other'
        const tags = groups.get(title) ?? []
        tags.push({ id, name })
        groups.set(title, tags)
    }

    return [...groups.entries()]
        .sort(([left], [right]) =>
            left === 'Other' ? 1 : right === 'Other' ? -1 :
                left.localeCompare(right, 'en')
        )
        .map(([title, tags]) => ({
            id: categoryId(title),
            title,
            tags: tags.sort((left, right) =>
                left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })
            )
        }))
}
