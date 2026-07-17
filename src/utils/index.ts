import { EntitlementRefV2025, EntitlementV2025 } from 'sailpoint-api-client'
import { stringToMembership } from './membership-parser'
import { buildEntitlementVelocityContext, evaluateVelocityExpression } from './velocity'

export const entitlementToRef = (entitlement: EntitlementV2025): EntitlementRefV2025 => ({
    id: entitlement.id!,
    name: entitlement.name!,
    type: 'ENTITLEMENT',
})

// ⚡ Bolt: Use O(n) frequency map logic instead of O(n log n) array sorting
export const areStringArraysEqual = (a?: string[], b?: string[]): boolean => {
    const arrA = a ?? []
    const arrB = b ?? []
    if (arrA.length !== arrB.length) return false

    const counts = new Map<string, number>()
    for (let i = 0; i < arrA.length; i++) {
        const val = arrA[i]
        counts.set(val, (counts.get(val) || 0) + 1)
    }

    for (let i = 0; i < arrB.length; i++) {
        const val = arrB[i]
        const count = counts.get(val)
        if (!count) return false
        counts.set(val, count - 1)
    }

    return true
}

export { areEntitlementRefsEqual, areJsonEqual } from './comparison'
export { stringToMembership }
export { evaluateVelocityExpression } from './velocity'
export { buildEntitlementVelocityContext } from './velocity'
export {
    pushToGroupMap,
    buildApprovalSchemesConfig,
    buildEntitlementPatch,
    buildEntitlementRequestConfig,
    detectRequestableAndConfigChanges,
    shouldSkipUpdate,
} from './aggregation'
export type { EntitlementPatchOptions, ChangeDetectionResult } from './aggregation'
export { runWithConcurrency } from './concurrency'
export { searchWithFallback } from './search-fallback'
export type { SearchFallbackOptions } from './search-fallback'

export const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: unknown }).message)
    }
    if (typeof error === 'string') {
        return error
    }
    return 'An unknown error occurred'
}

export const escapeFilterString = (value: string): string => {
    if (!value) return value
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

// ⚡ Bolt: Worker-pool implementation for concurrent processing
export const processConcurrent = async <T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency: number = 10
): Promise<R[]> => {
    const results: R[] = new Array(items.length)
    let currentIndex = 0

    const worker = async () => {
        while (true) {
            const index = currentIndex++
            if (index >= items.length) {
                break
            }
            results[index] = await processor(items[index])
        }
    }

    const workers: Promise<void>[] = []
    for (let i = 0; i < Math.min(concurrency, items.length); i++) {
        workers.push(worker())
    }

    await Promise.all(workers)
    return results
}
