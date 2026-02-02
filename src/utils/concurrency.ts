/**
 * Runs async tasks with a maximum concurrency limit.
 * Use to avoid overwhelming the API while still parallelizing work.
 */
export async function runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    if (items.length === 0) return []
    const results: R[] = new Array(items.length)
    let index = 0

    async function worker(): Promise<void> {
        while (index < items.length) {
            const i = index++
            if (i >= items.length) break
            results[i] = await fn(items[i])
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
    await Promise.all(workers)
    return results
}
