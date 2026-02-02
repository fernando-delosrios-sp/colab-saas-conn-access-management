import { EntitlementRefV2025, EntitlementV2025 } from 'sailpoint-api-client'
import { stringToMembership } from './membership-parser'
import { evaluateVelocityTemplate } from './velocity'

/**
 * Evaluates a Velocity template using entitlement attributes as context.
 * @param entitlement - The entitlement whose attributes will be used as template context
 * @param template - The Velocity template string to evaluate
 * @returns The rendered template string
 */
export const buildName = (entitlement: EntitlementV2025, template: string): string => {
    return evaluateVelocityTemplate(template, entitlement.attributes as Record<string, unknown>)
}

export const entitlementToRef = (entitlement: EntitlementV2025): EntitlementRefV2025 => {
    return {
        id: entitlement.id!,
        name: entitlement.name!,
        type: 'ENTITLEMENT',
    }
}

export const areStringArraysEqual = (a?: string[], b?: string[]): boolean => {
    const arrA = (a ?? []).slice().sort()
    const arrB = (b ?? []).slice().sort()
    if (arrA.length !== arrB.length) return false
    return arrA.every((val, idx) => val === arrB[idx])
}

export { areEntitlementRefsEqual, areJsonEqual } from './comparison'
export { stringToMembership }
export { evaluateVelocityTemplate } from './velocity'
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
