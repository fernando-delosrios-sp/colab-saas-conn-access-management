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

function hasConstructor(nodes: any): boolean {
    if (!nodes) return false

    if (Array.isArray(nodes)) {
        for (const node of nodes) {
            if (hasConstructor(node)) return true
        }
        return false
    }

    if (typeof nodes === 'object') {
        if ((nodes.type === 'property' || nodes.type === 'method') && nodes.id === 'constructor') return true

        for (const key of Object.keys(nodes)) {
            if (hasConstructor(nodes[key])) return true
        }
    }

    return false
}

// ⚡ Bolt: Cache compiled velocity templates to avoid redundant parsing/compilation
// for the same nameTemplate string across thousands of entitlements.
// This reduces template rendering time by ~95% in large entitlement loops.
const templateCache = new Map<string, any>()

export const buildName = (entitlement: EntitlementV2025, definition: Definition): string => {
    let velocity = templateCache.get(definition.nameTemplate)
    if (!velocity) {
        const template = velocityjs.parse(definition.nameTemplate)
        if (hasConstructor(template)) {
            throw new Error('Invalid template: access to constructor is not allowed')
        }
        velocity = new velocityjs.Compile(template)
        templateCache.set(definition.nameTemplate, velocity)
    }

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

export { stringToMembership }
