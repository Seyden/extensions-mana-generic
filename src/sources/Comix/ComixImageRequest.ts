import {
    HttpClient,
} from '@mana-app/types'
import { COMIX_DOMAIN } from './ComixInfo'

export function createComixImageHeaders(url: string): Record<string, string> {
    const hostname = new URL(url).hostname
    const comixHostname = new URL(COMIX_DOMAIN).hostname
    const isComixHost = hostname === comixHostname || hostname.endsWith(`.${comixHostname}`)

    return {
        // External image hosts reject requests carrying Comix's Referer.
        ...(isComixHost ? { Referer: `${COMIX_DOMAIN}/` } : {}),
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5'
    }
}

export function createComixImageTransport(): HttpClient {
    return new HttpClient()
        .addRequestInterceptor((request) => {
            request.headers
                .delete('Referer')
                .setAll(createComixImageHeaders(request.url))

            return request
        })
}
