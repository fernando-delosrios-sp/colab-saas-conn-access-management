import {
    EntitlementApprovalSchemeV2025ApproverTypeV2025,
    EntitlementRequestConfigV2025,
    EntitlementV2025,
    JsonPatchOperationV2025,
} from 'sailpoint-api-client'
import { areEntitlementRefsEqual, areJsonEqual } from './comparison'

/**
 * Adds an entitlement to a group map, creating the group array if it doesn't exist.
 * Used when grouping entitlements by expression result (role name, access profile name, etc.).
 */
export function pushToGroupMap<K>(map: Map<K, EntitlementV2025[]>, key: K, entitlement: EntitlementV2025): void {
    if (!map.has(key)) {
        map.set(key, [])
    }
    map.get(key)!.push(entitlement)
}

/**
 * Builds the access request config object with approval schemes from approver type.
 */
export function buildApprovalSchemesConfig(approverType: string): { approvalSchemes: { approverType: string }[] } {
    return { approvalSchemes: [{ approverType }] }
}

/**
 * Builds entitlement request config for PUT /entitlements/:id/entitlement-request-config.
 */
export function buildEntitlementRequestConfig(approverType: string): EntitlementRequestConfigV2025 {
    return {
        accessRequestConfig: {
            approvalSchemes: [{ approverType: approverType as EntitlementApprovalSchemeV2025ApproverTypeV2025 }],
        },
    }
}

export interface EntitlementPatchOptions {
    requestable?: boolean
    accessRequestConfig?: unknown
    membership?: unknown
    changes?: ChangeDetectionResult
}

/**
 * Builds JSON patch operations for updating entitlements on access profiles/roles.
 */
export function buildEntitlementPatch(
    entitlements: { id?: string | null }[],
    options?: EntitlementPatchOptions
): JsonPatchOperationV2025[] {
    const patch: JsonPatchOperationV2025[] = []

    const changes = options?.changes

    // Conditionally include replace operations only for fields that have explicitly changed
    if (!changes || changes.entitlementsChanged) {
        patch.push({
            op: 'replace',
            path: '/entitlements',
            value: entitlements as JsonPatchOperationV2025['value'],
        })
    }
    if (!changes || changes.enabledChanged) {
        patch.push({
            op: 'replace',
            path: '/enabled',
            value: true as JsonPatchOperationV2025['value'],
        })
    }

    if (options?.requestable !== undefined && (!changes || changes.requestableChanged)) {
        const isRequestable = options.requestable === true || String(options.requestable) === 'true'
        patch.push({ op: 'replace', path: '/requestable', value: isRequestable as JsonPatchOperationV2025['value'] })
    }
    if (options?.accessRequestConfig && (!changes || changes.accessRequestConfigChanged)) {
        patch.push({
            op: 'replace',
            path: '/accessRequestConfig',
            value: options.accessRequestConfig as JsonPatchOperationV2025['value'],
        })
    }
    if (options?.membership !== undefined && options.membership !== null && (!changes || changes.membershipChanged)) {
        patch.push({
            op: 'replace',
            path: '/membership',
            value: options.membership as JsonPatchOperationV2025['value'],
        })
    }
    return patch
}

export interface ChangeDetectionResult {
    entitlementsChanged: boolean
    requestableChanged: boolean
    accessRequestConfigChanged: boolean
    membershipChanged?: boolean
    enabledChanged?: boolean
}

/**
 * Compares desired vs existing values to detect if an update is needed.
 */
export function detectRequestableAndConfigChanges(
    existing: {
        entitlements?: { id?: string | null }[] | null
        requestable?: boolean
        accessRequestConfig?: unknown
        membership?: unknown
        enabled?: boolean
    },
    entitlements: { id?: string | null }[],
    requestable?: boolean,
    accessRequestConfig?: unknown,
    membership?: unknown
): ChangeDetectionResult {
    return {
        entitlementsChanged: !areEntitlementRefsEqual(existing.entitlements ?? null, entitlements),
        requestableChanged: requestable ? existing.requestable !== true : false,
        accessRequestConfigChanged: accessRequestConfig
            ? !areJsonEqual(existing.accessRequestConfig, accessRequestConfig)
            : false,
        membershipChanged: membership !== undefined ? !areJsonEqual(existing.membership, membership) : false,
        enabledChanged: existing.enabled !== true,
    }
}

/**
 * Returns true if no meaningful changes were detected (skip update).
 */
export function shouldSkipUpdate(result: ChangeDetectionResult, includeMembership = false): boolean {
    const { entitlementsChanged, requestableChanged, accessRequestConfigChanged, membershipChanged, enabledChanged } =
        result

    if (entitlementsChanged || requestableChanged || accessRequestConfigChanged || enabledChanged) {
        return false
    }

    if (includeMembership && membershipChanged) {
        return false
    }

    return true
}
