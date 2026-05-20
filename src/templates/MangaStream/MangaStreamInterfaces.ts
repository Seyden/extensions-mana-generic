import { ExcludableMultiSelectProp, Option } from '@mana-app/types'

export interface Months {
    january: string;
    february: string;
    march: string;
    april: string;
    may: string;
    june: string;
    july: string;
    august: string;
    september: string;
    october: string;
    november: string;
    december: string;
}

export interface StatusTypes {
    ONGOING: string;
    COMPLETED: string;
    DROPPED: string;
}

export type FilterProps = {
    status?: Option; // select
    type?: Option; // select
    order?: Option; // select
    chapters?: Option; // select

    genres?: Option[] | ExcludableMultiSelectProp;
};