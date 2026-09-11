import { ComixContentRating } from './ComixInterfaces'

export type ComixPosterQuality = 'small' | 'medium' | 'large'
export type ComixScorePosition = 'top' | 'bottom' | 'none'
export type ComixRatingPreference = 'all' | ComixContentRating

export interface ComixPreferences {
    posterQuality: ComixPosterQuality
    contentRating: ComixRatingPreference
    defaultTypes: string[]
    defaultDemographics: string[]
    blockedGenres: string[]
    deduplicateChapters: boolean
    scanlatorBlacklist: string
    showAlternativeTitlesInSummary: boolean
    showExtraInfo: boolean
    showNarrativeTags: boolean
    scorePosition: ComixScorePosition
}

const ALL_TYPES = ['manga', 'manhwa', 'manhua', 'other']
const ALL_DEMOGRAPHICS = ['1', '2', '3', '4']

const KEYS = {
    posterQuality: 'Comix.posterQuality',
    contentRating: 'Comix.contentRating',
    defaultTypes: 'Comix.defaultTypes',
    defaultDemographics: 'Comix.defaultDemographics',
    blockedGenres: 'Comix.blockedGenres',
    deduplicateChapters: 'Comix.deduplicateChapters',
    scanlatorBlacklist: 'Comix.scanlatorBlacklist',
    showAlternativeTitlesInSummary: 'Comix.showAlternativeTitlesInSummary',
    showExtraInfo: 'Comix.showExtraInfo',
    showNarrativeTags: 'Comix.showNarrativeTags',
    scorePosition: 'Comix.scorePosition'
} as const

export const DEFAULT_COMIX_PREFERENCES: ComixPreferences = {
    posterQuality: 'large',
    contentRating: 'all',
    defaultTypes: ALL_TYPES,
    defaultDemographics: ALL_DEMOGRAPHICS,
    blockedGenres: [],
    deduplicateChapters: false,
    scanlatorBlacklist: '',
    showAlternativeTitlesInSummary: false,
    showExtraInfo: true,
    showNarrativeTags: false,
    scorePosition: 'top'
}

function isOneOf<T extends string>(value: string | null, values: readonly T[]): value is T {
    return value !== null && (values as readonly string[]).includes(value)
}

export async function loadComixPreferences(): Promise<ComixPreferences> {
    const posterQuality = await ObjectStore.string(KEYS.posterQuality)
    const contentRating = await ObjectStore.string(KEYS.contentRating)
    const scorePosition = await ObjectStore.string(KEYS.scorePosition)

    return {
        posterQuality: isOneOf(posterQuality, ['small', 'medium', 'large'])
            ? posterQuality
            : DEFAULT_COMIX_PREFERENCES.posterQuality,
        contentRating: isOneOf(
            contentRating,
            ['all', 'safe', 'suggestive', 'erotica', 'pornographic']
        )
            ? contentRating
            : DEFAULT_COMIX_PREFERENCES.contentRating,
        defaultTypes: await ObjectStore.stringArray(KEYS.defaultTypes) ??
            DEFAULT_COMIX_PREFERENCES.defaultTypes,
        defaultDemographics: await ObjectStore.stringArray(KEYS.defaultDemographics) ??
            DEFAULT_COMIX_PREFERENCES.defaultDemographics,
        blockedGenres: await ObjectStore.stringArray(KEYS.blockedGenres) ??
            DEFAULT_COMIX_PREFERENCES.blockedGenres,
        deduplicateChapters: await ObjectStore.boolean(KEYS.deduplicateChapters) ??
            DEFAULT_COMIX_PREFERENCES.deduplicateChapters,
        scanlatorBlacklist: await ObjectStore.string(KEYS.scanlatorBlacklist) ??
            DEFAULT_COMIX_PREFERENCES.scanlatorBlacklist,
        showAlternativeTitlesInSummary:
            await ObjectStore.boolean(KEYS.showAlternativeTitlesInSummary) ??
            DEFAULT_COMIX_PREFERENCES.showAlternativeTitlesInSummary,
        showExtraInfo: await ObjectStore.boolean(KEYS.showExtraInfo) ??
            DEFAULT_COMIX_PREFERENCES.showExtraInfo,
        showNarrativeTags: await ObjectStore.boolean(KEYS.showNarrativeTags) ??
            DEFAULT_COMIX_PREFERENCES.showNarrativeTags,
        scorePosition: isOneOf(scorePosition, ['top', 'bottom', 'none'])
            ? scorePosition
            : DEFAULT_COMIX_PREFERENCES.scorePosition
    }
}

export function saveComixPreference<Key extends keyof ComixPreferences>(
    key: Key,
    value: ComixPreferences[Key]
): Promise<void> {
    return ObjectStore.set(KEYS[key], value)
}

export function contentRatingsForPreference(
    preference: ComixRatingPreference
): ComixContentRating[] | undefined {
    const ratings: ComixContentRating[] = [
        'safe',
        'suggestive',
        'erotica',
        'pornographic'
    ]
    if (preference === 'all') return undefined

    const maximumIndex = ratings.indexOf(preference)
    return maximumIndex >= 0 ? ratings.slice(0, maximumIndex + 1) : undefined
}

export function buildComixPreferenceParams(
    preferences: ComixPreferences
): Record<string, unknown> {
    const params: Record<string, unknown> = {}
    const ratings = contentRatingsForPreference(preferences.contentRating)
    if (ratings?.length) params.content_rating = ratings

    if (
        preferences.defaultTypes.length > 0 &&
        preferences.defaultTypes.length < ALL_TYPES.length
    ) {
        params.types = preferences.defaultTypes
    }
    if (
        preferences.defaultDemographics.length > 0 &&
        preferences.defaultDemographics.length < ALL_DEMOGRAPHICS.length
    ) {
        params.demographics = preferences.defaultDemographics
    }
    if (preferences.blockedGenres.length > 0) {
        params.genres_ex = preferences.blockedGenres
        params.genres_mode = 'and'
    }

    return params
}
