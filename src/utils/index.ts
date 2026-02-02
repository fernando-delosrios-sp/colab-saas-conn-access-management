import { EntitlementRefV2025, EntitlementV2025 } from 'sailpoint-api-client'
import { stringToMembership } from './membership-parser'
import { evaluateVelocityTemplate } from './velocity'

// export const normalizeAttributes = (entitlement: EntitlementV2025, _group: string | undefined): EntitlementV2025 => {
//     const attributes = {
//         ...entitlement.attributes,
//         name: entitlement.name,
//         value: entitlement.value,
//         _source: entitlement.source?.name,
//         _group,
//     }

//     return { ...entitlement, attributes }
// }

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
