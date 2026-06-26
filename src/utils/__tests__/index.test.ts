import { areEntitlementRefsEqual } from '../index'

describe('areEntitlementRefsEqual', () => {
    it('returns true for two empty arrays', () => {
        expect(areEntitlementRefsEqual([], [])).toBe(true)
    })

    it('returns true when one array is null and the other is empty', () => {
        expect(areEntitlementRefsEqual(null, [])).toBe(true)
    })

    it('returns true when a is null and b is undefined', () => {
        expect(areEntitlementRefsEqual(null, undefined)).toBe(true)
    })

    it('returns true when both are undefined', () => {
        expect(areEntitlementRefsEqual(undefined, undefined)).toBe(true)
    })

    it('returns true for identical arrays with same order', () => {
        const a = [{ id: '1' }, { id: '2' }]
        const b = [{ id: '1' }, { id: '2' }]
        expect(areEntitlementRefsEqual(a, b)).toBe(true)
    })

    it('returns true for identical arrays with different order', () => {
        const a = [{ id: '1' }, { id: '2' }]
        const b = [{ id: '2' }, { id: '1' }]
        expect(areEntitlementRefsEqual(a, b)).toBe(true)
    })

    it('returns false for arrays with different lengths', () => {
        const a = [{ id: '1' }]
        const b = [{ id: '1' }, { id: '2' }]
        expect(areEntitlementRefsEqual(a, b)).toBe(false)
    })

    it('returns false for arrays with same length but different IDs', () => {
        const a = [{ id: '1' }, { id: '2' }]
        const b = [{ id: '1' }, { id: '3' }]
        expect(areEntitlementRefsEqual(a, b)).toBe(false)
    })

    it('filters out null/undefined IDs correctly', () => {
        const a = [{ id: '1' }, { id: null }, { id: undefined }]
        const b = [{ id: '1' }]
        expect(areEntitlementRefsEqual(a, b)).toBe(true)
    })

    it('handles arrays with objects lacking id property', () => {
        const a = [{ id: '1' }, {}]
        const b = [{ id: '1' }]
        expect(areEntitlementRefsEqual(a, b)).toBe(true)
    })
})
