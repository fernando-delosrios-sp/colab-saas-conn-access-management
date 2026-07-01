import { retriesConfig } from './axios'
import axiosRetry from 'axios-retry'

jest.mock('axios-retry', () => ({
    isNetworkError: jest.fn(),
    isRetryableError: jest.fn(),
}))

describe('axios retriesConfig', () => {
    describe('retryCondition', () => {
        beforeEach(() => {
            jest.clearAllMocks()
        })

        it('should return true if it is a network error', () => {
            ;(axiosRetry.isNetworkError as jest.Mock).mockReturnValue(true)
            ;(axiosRetry.isRetryableError as jest.Mock).mockReturnValue(false)

            const error = { name: 'Error', message: 'Test error' } as any

            const result = retriesConfig.retryCondition!(error)
            expect(result).toBe(true)
            expect(axiosRetry.isNetworkError).toHaveBeenCalledWith(error)
        })

        it('should return true if it is a retryable error', () => {
            ;(axiosRetry.isNetworkError as jest.Mock).mockReturnValue(false)
            ;(axiosRetry.isRetryableError as jest.Mock).mockReturnValue(true)

            const error = { name: 'Error', message: 'Test error' } as any

            const result = retriesConfig.retryCondition!(error)
            expect(result).toBe(true)
            expect(axiosRetry.isRetryableError).toHaveBeenCalledWith(error)
        })

        it('should return true if status is 429', () => {
            ;(axiosRetry.isNetworkError as jest.Mock).mockReturnValue(false)
            ;(axiosRetry.isRetryableError as jest.Mock).mockReturnValue(false)

            const error = {
                name: 'Error',
                message: 'Test error',
                response: { status: 429 }
            } as any

            const result = retriesConfig.retryCondition!(error)
            expect(result).toBe(true)
        })

        it('should return false if none of the conditions are met', () => {
            ;(axiosRetry.isNetworkError as jest.Mock).mockReturnValue(false)
            ;(axiosRetry.isRetryableError as jest.Mock).mockReturnValue(false)

            const error = {
                name: 'Error',
                message: 'Test error',
                response: { status: 500 }
            } as any

            const result = retriesConfig.retryCondition!(error)
            expect(result).toBe(false)
        })

        it('should return false if response is undefined and not network/retryable error', () => {
            ;(axiosRetry.isNetworkError as jest.Mock).mockReturnValue(false)
            ;(axiosRetry.isRetryableError as jest.Mock).mockReturnValue(false)

            const error = {
                name: 'Error',
                message: 'Test error'
            } as any

            const result = retriesConfig.retryCondition!(error)
            expect(result).toBe(false)
        })
    })
})
