/**
 * Sliding-window throttle: max 100 requests per 10 seconds.
 */
const MAX_REQUESTS = 100
const WINDOW_MS = 10_000

const timestamps: number[] = []
let mutex: Promise<void> = Promise.resolve()

export async function throttle(): Promise<void> {
    mutex = mutex.then(async () => {
        for (;;) {
            const now = Date.now()
            const windowStart = now - WINDOW_MS

            while (timestamps.length > 0 && timestamps[0] < windowStart) {
                timestamps.shift()
            }

            if (timestamps.length < MAX_REQUESTS) {
                timestamps.push(now)
                return
            }

            const waitMs = timestamps[0] + WINDOW_MS - now
            if (waitMs > 0) {
                await new Promise(resolve => setTimeout(resolve, waitMs))
            }
        }
    })
    return mutex
}
