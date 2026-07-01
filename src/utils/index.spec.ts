import { areJsonEqual, areEntitlementRefsEqual } from './index'

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

describe('areEntitlementRefsEqual', () => {
    it('should return true for null or undefined arrays', () => {
        expect(areEntitlementRefsEqual(null, undefined)).toBe(true)
        expect(areEntitlementRefsEqual(undefined, null as any)).toBe(true)
        expect(areEntitlementRefsEqual(null, null as any)).toBe(true)
    })

    it('should return true for empty arrays', () => {
        expect(areEntitlementRefsEqual([], [])).toBe(true)
        expect(areEntitlementRefsEqual(null, [])).toBe(true)
    })

    it('should return true for arrays with same ids in same order', () => {
        expect(areEntitlementRefsEqual([{ id: '1' }, { id: '2' }], [{ id: '1' }, { id: '2' }])).toBe(true)
    })

    it('should return true for arrays with same ids in different order', () => {
        expect(areEntitlementRefsEqual([{ id: '1' }, { id: '2' }], [{ id: '2' }, { id: '1' }])).toBe(true)
    })

    it('should return false for arrays with different ids', () => {
        expect(areEntitlementRefsEqual([{ id: '1' }, { id: '2' }], [{ id: '1' }, { id: '3' }])).toBe(false)
    })

    it('should return false for arrays of different lengths', () => {
        expect(areEntitlementRefsEqual([{ id: '1' }, { id: '2' }], [{ id: '1' }])).toBe(false)
    })

    it('should ignore missing or null ids', () => {
        expect(areEntitlementRefsEqual([{ id: '1' }, { id: null }], [{ id: '1' }])).toBe(true)
        expect(areEntitlementRefsEqual([{ id: '1' }, {}], [{ id: '1' }])).toBe(true)
    })
})
