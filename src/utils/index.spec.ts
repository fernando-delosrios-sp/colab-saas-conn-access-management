import { areJsonEqual, entitlementToRef } from './index'
import { EntitlementV2025 } from 'sailpoint-api-client'

describe('areJsonEqual', () => {
    it('should return true for identical primitive values', () => {
        expect(areJsonEqual('a', 'a')).toBe(true)
        expect(areJsonEqual(1, 1)).toBe(true)
        expect(areJsonEqual(true, true)).toBe(true)
    })

    it('should return false for different primitive values', () => {
        expect(areJsonEqual('a', 'b')).toBe(false)
        expect(areJsonEqual(1, 2)).toBe(false)
        expect(areJsonEqual(true, false)).toBe(false)
    })

    it('should return true for identical arrays and objects', () => {
        expect(areJsonEqual([1, 2, 3], [1, 2, 3])).toBe(true)
        expect(areJsonEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
    })

    it('should return false for different arrays and objects', () => {
        expect(areJsonEqual([1, 2, 3], [1, 2])).toBe(false)
        expect(areJsonEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
        expect(areJsonEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false)
        // Note: JSON.stringify is order-dependent for object keys
        expect(areJsonEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false)
    })

    it('should return true for identical deeply nested objects', () => {
        const obj1 = { a: { b: { c: [1, 2, 3] } } }
        const obj2 = { a: { b: { c: [1, 2, 3] } } }
        expect(areJsonEqual(obj1, obj2)).toBe(true)
    })

    it('should handle null and undefined values properly', () => {
        expect(areJsonEqual(null, null)).toBe(true)
        expect(areJsonEqual(undefined, undefined)).toBe(true)
        expect(areJsonEqual(null, undefined)).toBe(true)
        expect(areJsonEqual(undefined, null)).toBe(true)

        expect(areJsonEqual(null, 'a')).toBe(false)
        expect(areJsonEqual(undefined, 'a')).toBe(false)
    })
})

describe('entitlementToRef', () => {
    it('should correctly transform an EntitlementV2025 to EntitlementRefV2025', () => {
        const entitlement = {
            id: 'ent123',
            name: 'Admin Access',
        } as unknown as EntitlementV2025

        const result = entitlementToRef(entitlement)

        expect(result).toEqual({
            id: 'ent123',
            name: 'Admin Access',
            type: 'ENTITLEMENT',
        })
    })

    it('should ignore extra properties in the input object', () => {
        const entitlement: any = {
            id: 'ent456',
            name: 'User Access',
            type: 'ENTITLEMENT',
            description: 'Basic access',
            created: '2023-01-01T00:00:00Z',
            attributes: { role: 'user' },
        }

        const result = entitlementToRef(entitlement)

        expect(result).toEqual({
            id: 'ent456',
            name: 'User Access',
            type: 'ENTITLEMENT',
        })
    })
})
