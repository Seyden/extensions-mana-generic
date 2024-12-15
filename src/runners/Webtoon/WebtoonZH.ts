import { RunnerInfo } from '@suwatte/daisuke'

import {
    BASE_URL_XX,
    MOBILE_URL_XX,
    Webtoon,
    WebtoonBaseInfo
} from '../../templates/Webtoon/Webtoon'

const SOURCE_NAME = 'WebtoonZH'
const LOCALE = 'zh-hant'
const DATE_FORMAT = 'l'
const LANGUAGE = 'zh-tw'
const BASE_URL = `${BASE_URL_XX}/${LOCALE}`
const MOBILE_URL = `${MOBILE_URL_XX}/${LOCALE}`
const HAVE_TRENDING = true

export class Target extends Webtoon {

    info: RunnerInfo = {
        id: SOURCE_NAME,
        name: SOURCE_NAME,
        ...WebtoonBaseInfo,
        supportedLanguages: [LANGUAGE]
    }

    constructor (){
        super(LOCALE, DATE_FORMAT, LANGUAGE, BASE_URL, MOBILE_URL, HAVE_TRENDING)
    }
}