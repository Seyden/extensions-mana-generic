import {
    Form,
    ImageRequestHandler,
    NetworkClientBuilder,
    NetworkRequest,
    PageLink,
    ResolvedPageSection,
    SourcePreferenceProvider
} from '@mana-app/types'
import { AsuraScansParser } from './AsuraScansParser'
import { UITextField } from '@mana-app/types/dist/types/UI/UIElementBuilders'
import { ASURASCANS_DOMAIN } from './AsuraScansInfo'

const simpleUrl = require('simple-url')

export class AsuraScansBase implements ImageRequestHandler, SourcePreferenceProvider {

    parser = new AsuraScansParser()
    language: string = 'en_GB'
    sourceTraversalPathName = 'browse'
    fallbackImage = 'https://i.imgur.com/GYUxEX8.png'

    client: NetworkClient = new NetworkClientBuilder()
        .setRateLimit(15, 1)
        .setTimeout(30000)
        .addRequestInterceptor(async (request) => {
            const url = await this.getBaseUrl()
            request.headers = { ...(request.headers ?? {}), referer: `${url}/` }

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
        .build()

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
                        async didChange(value) { return ObjectStore.set('Domain', value) }
                    })
                ]
            }]
        }
    }

    async willRequestImage(url: string): Promise<NetworkRequest> {
        const baseUrl = await this.getBaseUrl()
        return {
            url,
            headers: {
                'referer': `${baseUrl}/`,
                'Accept': 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br, zstd'
            }
        }
    }

    resolvePageSection(_link: PageLink, _sectionID: string): Promise<ResolvedPageSection> {
        throw new Error('Method not needed.')
    }
}
