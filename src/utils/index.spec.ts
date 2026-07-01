import { areJsonEqual, areStringArraysEqual } from './index'

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

describe('areStringArraysEqual', () => {
    it('should return true for identical empty arrays and undefined inputs', () => {
        expect(areStringArraysEqual(undefined, undefined)).toBe(true)
        expect(areStringArraysEqual([], [])).toBe(true)
        expect(areStringArraysEqual(undefined, [])).toBe(true)
        expect(areStringArraysEqual([], undefined)).toBe(true)
    })

    it('should return true for arrays with the same elements in the same order', () => {
        expect(areStringArraysEqual(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true)
    })

    it('should return true for arrays with the same elements in different order', () => {
        expect(areStringArraysEqual(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true)
    })

    it('should return true for arrays with same elements and identical duplicate counts', () => {
        expect(areStringArraysEqual(['a', 'a', 'b'], ['b', 'a', 'a'])).toBe(true)
    })

    it('should return false for arrays with different lengths', () => {
        expect(areStringArraysEqual(['a', 'b'], ['a', 'b', 'c'])).toBe(false)
        expect(areStringArraysEqual(['a', 'b', 'c'], ['a', 'b'])).toBe(false)
    })

    it('should return false for arrays with different elements', () => {
        expect(areStringArraysEqual(['a', 'b'], ['a', 'c'])).toBe(false)
    })

    it('should return false for arrays with same elements but different frequencies', () => {
        expect(areStringArraysEqual(['a', 'a', 'b'], ['a', 'b', 'b'])).toBe(false)
        expect(areStringArraysEqual(['a', 'b', 'b'], ['a', 'a', 'b'])).toBe(false)
    })
})
