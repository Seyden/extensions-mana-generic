import {
    Form,
    CoverRequestHandler,
    PageRequestHandler,
    HttpClient,
    PageLink,
    ResolvedPageSection,
    SourcePreferenceProvider,
    ImageRequest,
    RequestOrigin,
} from '@mana-app/types'
import { AsuraScansParser } from './AsuraScansParser'
import { UITextField } from '@mana-app/types/dist/types/UI/UIElementBuilders'
import { ASURASCANS_DOMAIN } from './AsuraScansInfo'

const simpleUrl = require('simple-url')

export class AsuraScansBase implements CoverRequestHandler, PageRequestHandler, SourcePreferenceProvider {

    parser = new AsuraScansParser()
    language: string = 'en_GB'
    sourceTraversalPathName = 'browse'
    fallbackImage = 'https://i.imgur.com/GYUxEX8.png'

    client: HttpClient = new HttpClient()
        .setRateLimit(15, 1_000)
        .setTimeoutMs(30000)
        .addRequestInterceptor(async (request, context) => {
            const url = await this.getBaseUrl()
            request.headers.referer = `${url}/`

            if (context.origin !== RequestOrigin.General) {
                request.headers.accept = 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5'
                request.headers['accept-encoding'] = 'gzip, deflate, br, zstd'
            }

            const path: any = simpleUrl.parse(request.url, true)
            if (!path.protocol || path.protocol == 'http') {
                path.protocol = 'https'
                request.url = simpleUrl.create(path)
            }

            return request
        })
        .addResponseInterceptor(async (response) => {
            if (response.headers.location) {
                response.headers.location = response.headers.location.replace(/^http:/, 'https:')
            }

            return response
        })

    async getBaseUrl(): Promise<string> {
        const settingsUrl: string = await ObjectStore.string('Domain') ?? ASURASCANS_DOMAIN
        return settingsUrl ? settingsUrl : ASURASCANS_DOMAIN
    }

    async getPreferenceMenu(): Promise<Form> {
        return {
            sections: [{
                footer: 'Override the domain url for the source.',
                children: [
                    UITextField({
                        id: 'domain',
                        title: 'Domain',
                        value: await this.getBaseUrl(),
                        async didChange(value) {
                            return ObjectStore.set('Domain', value)
                        }
                    })
                ]
            }]
        }
    }

    getCoverTransport(_request: ImageRequest): HttpClient {
        return this.client
    }

    getPageTransport(_request: ImageRequest): HttpClient {
        return this.client
    }

    resolvePageSection(_link: PageLink, _sectionID: string): Promise<ResolvedPageSection> {
        throw new Error('Method not needed.')
    }
}
