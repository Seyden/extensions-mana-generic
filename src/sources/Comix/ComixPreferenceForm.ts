import {
    Form,
    Option,
    UIListSection,
    UIMultiPicker,
    UIPicker,
    UITagsSection,
    UITextField,
    UIToggle
} from '@mana-app/types'
import { ComixBrowseOptions } from './ComixInterfaces'
import {
    ComixPreferences,
    saveComixPreference
} from './ComixPreferences'

function optionsFrom(
    values: Array<{ id: number | string; label: string }> | undefined,
    fallback: Option[]
): Option[] {
    return values?.length
        ? values.map((value) => ({ id: `${value.id}`, title: value.label }))
        : fallback
}

export function createComixPreferenceMenu(
    options: ComixBrowseOptions,
    preferences: ComixPreferences
): Form {
    const typeOptions = optionsFrom(options.types, [
        { id: 'manga', title: 'Manga' },
        { id: 'manhwa', title: 'Manhwa' },
        { id: 'manhua', title: 'Manhua' },
        { id: 'other', title: 'Other' }
    ])
    const demographicOptions = optionsFrom(options.demographics, [
        { id: '3', title: 'Josei' },
        { id: '4', title: 'Seinen' },
        { id: '1', title: 'Shoujo' },
        { id: '2', title: 'Shounen' }
    ])
    const genreOptions = optionsFrom(options.genres, [])

    return {
        sections: [
            UIListSection({
                header: 'Artwork',
                footer: 'Higher-quality thumbnails look sharper but use more data.',
                children: [
                    UIPicker({
                        id: 'posterQuality',
                        title: 'Thumbnail quality',
                        value: preferences.posterQuality,
                        options: [
                            { id: 'small', title: 'Small' },
                            { id: 'medium', title: 'Medium' },
                            { id: 'large', title: 'Large' }
                        ],
                        didChange: (value) =>
                            saveComixPreference(
                                'posterQuality',
                                value as ComixPreferences['posterQuality']
                            )
                    })
                ]
            }),
            UIListSection({
                header: 'Content filtering',
                footer: 'These defaults apply to Home and Browse. Search filters can override content rating, type, and demographic.',
                children: [
                    UIPicker({
                        id: 'contentRating',
                        title: 'Maximum content rating',
                        value: preferences.contentRating,
                        options: [
                            { id: 'all', title: 'Show all' },
                            { id: 'safe', title: 'Safe only' },
                            { id: 'suggestive', title: 'Up to Suggestive' },
                            { id: 'erotica', title: 'Up to Erotica' },
                            { id: 'pornographic', title: 'Up to Pornographic' }
                        ],
                        didChange: (value) =>
                            saveComixPreference(
                                'contentRating',
                                value as ComixPreferences['contentRating']
                            )
                    }),
                    UIMultiPicker({
                        id: 'defaultTypes',
                        title: 'Default types',
                        value: preferences.defaultTypes,
                        options: typeOptions,
                        optional: true,
                        didChange: (value) =>
                            saveComixPreference('defaultTypes', value)
                    }),
                    UIMultiPicker({
                        id: 'defaultDemographics',
                        title: 'Default demographics',
                        value: preferences.defaultDemographics,
                        options: demographicOptions,
                        optional: true,
                        didChange: (value) =>
                            saveComixPreference('defaultDemographics', value)
                    })
                ]
            }),
            UITagsSection({
                header: 'Blocked genres',
                footer: 'Tap genres to hide them from Home and Browse. Explicitly including a blocked genre overrides it for that search.',
                field: UIMultiPicker({
                    id: 'blockedGenres',
                    title: 'Blocked genres',
                    value: preferences.blockedGenres,
                    options: genreOptions,
                    optional: true,
                    didChange: (value) =>
                        saveComixPreference('blockedGenres', value)
                })
            }),
            UIListSection({
                header: 'Chapter releases',
                footer: 'When enabled, duplicate chapter numbers are reduced to one release. Official releases are preferred, followed by the best-voted and newest release.',
                children: [
                    UIToggle({
                        id: 'deduplicateChapters',
                        title: 'Deduplicate chapters',
                        value: preferences.deduplicateChapters,
                        didChange: (value) =>
                            saveComixPreference('deduplicateChapters', value)
                    })
                ]
            }),
            UIListSection({
                header: 'Scanlator blacklist',
                footer: 'Enter comma-separated scanlation group names or numeric group IDs. Matching chapter releases will be hidden; leave empty to show every group.',
                children: [
                    UITextField({
                        id: 'scanlatorBlacklist',
                        title: 'Groups to exclude',
                        placeholder: 'Violet Scans, 307',
                        value: preferences.scanlatorBlacklist,
                        optional: true,
                        didChange: (value) =>
                            saveComixPreference('scanlatorBlacklist', value)
                    })
                ]
            }),
            UIListSection({
                header: 'Title details',
                footer: 'Controls the extra information shown in descriptions and which narrative tags appear alongside genres.',
                children: [
                    UIToggle({
                        id: 'showAlternativeTitlesInSummary',
                        title: 'Show alternative names in summary',
                        value: preferences.showAlternativeTitlesInSummary,
                        didChange: (value) =>
                            saveComixPreference('showAlternativeTitlesInSummary', value)
                    }),
                    UIToggle({
                        id: 'showExtraInfo',
                        title: 'Show extra information in summary',
                        value: preferences.showExtraInfo,
                        didChange: (value) =>
                            saveComixPreference('showExtraInfo', value)
                    }),
                    UIToggle({
                        id: 'showNarrativeTags',
                        title: 'Show narrative tags',
                        value: preferences.showNarrativeTags,
                        didChange: (value) =>
                            saveComixPreference('showNarrativeTags', value)
                    }),
                    UIPicker({
                        id: 'scorePosition',
                        title: 'Score display position',
                        value: preferences.scorePosition,
                        options: [
                            { id: 'top', title: 'Top of summary' },
                            { id: 'bottom', title: 'Bottom of summary' },
                            { id: 'none', title: 'Do not show' }
                        ],
                        didChange: (value) =>
                            saveComixPreference(
                                'scorePosition',
                                value as ComixPreferences['scorePosition']
                            )
                    })
                ]
            })
        ]
    }
}
