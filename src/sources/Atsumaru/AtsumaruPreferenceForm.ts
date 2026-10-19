import {
    Form,
    Option,
    UIGroup,
    UIListSection,
    UIMultiPicker,
    UIMultiPickerSheet,
    UITagsSection
} from '@mana-app/types'
import {
    ATSUMARU_TYPES,
    AtsumaruPreferences,
    saveAtsumaruPreference
} from './AtsumaruPreferences'
import { AtsumaruFilterData } from './AtsumaruTypes'
import { groupAtsumaruTags } from './AtsumaruTags'

const TYPE_TITLES: Record<string, string> = {
    Manga: 'Manga',
    Manwha: 'Manhwa',
    Manhua: 'Manhua',
    OEL: 'OEL'
}

function options(values: Array<{ id: string; name: string }> | undefined): Option[] {
    return (values ?? []).map(({ id, name }) => ({ id, title: name }))
}

export function createAtsumaruPreferenceMenu(
    filters: AtsumaruFilterData,
    preferences: AtsumaruPreferences
): Form {
    const availableTypes = new Map(
        options(filters.types).map((option) => [option.id, option.title])
    )
    const typeOptions = ATSUMARU_TYPES.map((id) => ({
        id,
        title: availableTypes.get(id) ?? TYPE_TITLES[id] ?? id
    }))
    const tagGroups = groupAtsumaruTags(filters.tags)
    const excludedTags = new Set(preferences.excludedTags)
    const tagPickers = tagGroups.map((group) => {
        const ids = new Set(group.tags.map((tag) => tag.id))
        return UIMultiPickerSheet({
            id: `x_${group.id}`,
            title: group.title,
            value: preferences.excludedTags.filter((id) => ids.has(id)),
            options: options(group.tags),
            optional: true,
            didChange: (value) => {
                for (const id of ids) excludedTags.delete(id)
                for (const id of value) excludedTags.add(id)
                return saveAtsumaruPreference('excludedTags', [...excludedTags])
            }
        })
    })

    return {
        sections: [
            UITagsSection({
                header: 'Types',
                footer: 'Atsumaru is restricted to comic formats; novels and Other are not included.',
                field: UIMultiPicker({
                    id: 'types',
                    title: 'Types',
                    value: preferences.types,
                    options: typeOptions,
                    minSelectionCount: 1,
                    didChange: (value) => saveAtsumaruPreference('types', value)
                })
            }),
            UIListSection({
                header: 'Excluded genres & tags',
                footer: 'Selected items are excluded. Explicitly including them in Search overrides their exclusion.',
                children: [UIMultiPickerSheet({
                    id: 'excludedGenres',
                    title: 'Genres',
                    value: preferences.excludedGenres,
                    options: options(filters.genres),
                    optional: true,
                    didChange: (value) => saveAtsumaruPreference(
                        'excludedGenres',
                        value
                    )
                }), ...(tagPickers.length > 0 ? [UIGroup({
                    id: 'tags',
                    title: 'Tags',
                    children: tagPickers
                })] : [])]
            })
        ]
    }
}
