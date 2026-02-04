import { IAxiosRetryConfig } from 'axios-retry'
import { logger } from '@sailpoint/connector-sdk'
import { AxiosResponseHeaders } from 'axios'
import axiosRetry from 'axios-retry'

export const RETRIES = 10
export const REQUESTSPERSECOND = 10
export const RETRY_DELAY = 10 * 1000

export const retriesConfig: IAxiosRetryConfig = {
    retries: RETRIES,
    retryDelay: (retryCount, error) => {
        if (error.response?.headers) {
            const headers = error.response.headers as AxiosResponseHeaders
            const retryAfter = headers.get('retry-after')

            if (retryAfter) {
                return Number(retryAfter) * 1000
            }
        }

        return Math.min(Math.pow(2, retryCount) * 1000, RETRY_DELAY)
    },
    retryCondition: (error) => {
        return axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error) || error.response?.status === 429
    },
    onRetry: (retryCount, error, requestConfig) => {
        const status = error.response?.status || 'Network Error'
        const retryAfter = error.response?.headers ? (error.response.headers as AxiosResponseHeaders).get('retry-after') : null
        const delay = retryAfter || Math.min(Math.pow(2, retryCount) * 1000, 60 * 1000) / 1000
        const delayType = retryAfter ? 'server-specified' : 'exponential backoff'

        logger.warn(
            `Request to [${requestConfig.url}] failed with status [${status}]. ` +
            `Waiting ${delay}s (${delayType}) before retry attempt ${retryCount}/${RETRIES}`
        )
    },
}

export const throttleConfig = { requestsPerSecond: REQUESTSPERSECOND }
