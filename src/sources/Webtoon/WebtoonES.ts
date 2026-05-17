import { SourceInfo } from '@mana-app/types'

import {
    BASE_URL_XX,
    MOBILE_URL_XX,
    Webtoon,
    WebtoonBaseInfo
} from '../../templates/Webtoon/Webtoon'

const SOURCE_NAME = 'WebtoonES'
const LOCALE = 'es'
const DATE_FORMAT = 'D MMM YYYY'
const LANGUAGE = 'es-ES'
const BASE_URL = `${BASE_URL_XX}/${LOCALE}`
const MOBILE_URL = `${MOBILE_URL_XX}/${LOCALE}`
const HAVE_TRENDING = false




export class Target extends Webtoon {

    info: SourceInfo = {
        id: SOURCE_NAME,
        name: SOURCE_NAME,
        ...WebtoonBaseInfo,
        supportedLanguages: [LANGUAGE]
    }

    constructor (){
        super(LOCALE, DATE_FORMAT, LANGUAGE, BASE_URL, MOBILE_URL, HAVE_TRENDING)
    }
}