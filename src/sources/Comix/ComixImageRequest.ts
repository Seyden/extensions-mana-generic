import { NetworkRequest } from '@mana-app/types'
import { COMIX_DOMAIN } from './ComixInfo'

export function createComixImageRequest(url: string): NetworkRequest {
    return {
        url,
        headers: {
            Referer: `${COMIX_DOMAIN}/`,
            Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5'
        }
    }
}
