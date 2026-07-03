import { retriesConfig, RETRY_DELAY } from './axios'

describe('axios retriesConfig', () => {
    describe('retryDelay', () => {
        it('should use retry-after header if present', () => {
            const error = {
                response: {
                    headers: {
                        get: (name: string) => (name === 'retry-after' ? '5' : null),
                    },
                },
            } as any
            const delay = retriesConfig.retryDelay!(1, error)
            expect(delay).toBe(5000)
        })

        it('should fallback to exponential backoff if retry-after is not present', () => {
            const error = {
                response: {
                    headers: {
                        get: () => null,
                    },
                },
            } as any
            const delay1 = retriesConfig.retryDelay!(1, error)
            expect(delay1).toBe(2000)

            const delay2 = retriesConfig.retryDelay!(2, error)
            expect(delay2).toBe(4000)
        })

        it('should fallback to exponential backoff if error.response is undefined', () => {
            const error = {} as any
            const delay = retriesConfig.retryDelay!(3, error)
            expect(delay).toBe(8000)
        })

        it('should respect the maximum RETRY_DELAY', () => {
            const error = {} as any
            // 2^4 * 1000 = 16000, which is > RETRY_DELAY (10000)
            const delay = retriesConfig.retryDelay!(4, error)
            expect(delay).toBe(RETRY_DELAY)
        })
    })
})
