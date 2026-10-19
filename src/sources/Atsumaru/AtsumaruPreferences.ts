export const ATSUMARU_TYPES = ['Manga', 'Manwha', 'Manhua', 'OEL'] as const

export interface AtsumaruPreferences {
    types: string[]
    excludedGenres: string[]
    excludedTags: string[]
}

const KEYS = {
    types: 'Atsumaru.types',
    excludedGenres: 'Atsumaru.excludedGenres',
    excludedTags: 'Atsumaru.excludedTags'
} as const

export const DEFAULT_ATSUMARU_PREFERENCES: AtsumaruPreferences = {
    types: [...ATSUMARU_TYPES],
    excludedGenres: [],
    excludedTags: []
}

export async function loadAtsumaruPreferences(): Promise<AtsumaruPreferences> {
    const [types, excludedGenres, excludedTags] =
        await Promise.all([
            ObjectStore.stringArray(KEYS.types),
            ObjectStore.stringArray(KEYS.excludedGenres),
            ObjectStore.stringArray(KEYS.excludedTags)
        ])
    const selectedTypes = (types ?? []).filter((type) =>
        (ATSUMARU_TYPES as readonly string[]).includes(type)
    )

    return {
        types: selectedTypes.length > 0 ? selectedTypes : [...ATSUMARU_TYPES],
        excludedGenres: excludedGenres ?? [],
        excludedTags: excludedTags ?? []
    }
}

export function saveAtsumaruPreference<Key extends keyof AtsumaruPreferences>(
    key: Key,
    value: AtsumaruPreferences[Key]
): Promise<void> {
    return ObjectStore.set(KEYS[key], value)
}
