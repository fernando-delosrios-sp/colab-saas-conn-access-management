import { EntitlementRefV2025, EntitlementV2025 } from 'sailpoint-api-client'
import { Definition } from '../model/config'
import velocityjs from 'velocityjs'
import { stringToMembership } from './membership-parser'

export const normalizeAttributes = (entitlement: EntitlementV2025, _group: string | undefined): EntitlementV2025 => {
    const attributes = {
        ...entitlement.attributes,
        name: entitlement.name,
        value: entitlement.value,
        _source: entitlement.source?.name,
        _group,
    }

    return { ...entitlement, attributes }
}

export const buildName = (entitlement: EntitlementV2025, definition: Definition): string => {
    const template = velocityjs.parse(definition.nameTemplate)

    const velocity = new velocityjs.Compile(template)
    const name = velocity.render(entitlement.attributes)

    return name
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

export const areEntitlementRefsEqual = (a?: { id?: string | null }[] | null, b?: { id?: string | null }[]): boolean => {
    const idsA = (a ?? [])
        .map((x) => x.id ?? undefined)
        .filter(Boolean)
        .slice()
        .sort()
    const idsB = (b ?? [])
        .map((x) => x.id ?? undefined)
        .filter(Boolean)
        .slice()
        .sort()
    if (idsA.length !== idsB.length) return false
    return idsA.every((val, idx) => val === idsB[idx])
}

export const areJsonEqual = (a: any, b: any): boolean => {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export { stringToMembership }
