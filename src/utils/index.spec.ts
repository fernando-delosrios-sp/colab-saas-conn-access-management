import { areStringArraysEqual } from './index'

describe('areStringArraysEqual', () => {
    it('returns true for two identical arrays', () => {
        expect(areStringArraysEqual(['a', 'b'], ['a', 'b'])).toBe(true)
    })

    it('returns true for arrays with same elements in different order', () => {
        expect(areStringArraysEqual(['a', 'b'], ['b', 'a'])).toBe(true)
    })

    it('returns false for arrays of different lengths', () => {
        expect(areStringArraysEqual(['a', 'b'], ['a', 'b', 'c'])).toBe(false)
    })

    it('returns true when both are undefined', () => {
        expect(areStringArraysEqual(undefined, undefined)).toBe(true)
    })

    it('returns false when one is undefined and other is not empty', () => {
        expect(areStringArraysEqual(['a'], undefined)).toBe(false)
        expect(areStringArraysEqual(undefined, ['a'])).toBe(false)
    })

    it('returns true when one is undefined and other is empty array', () => {
        expect(areStringArraysEqual([], undefined)).toBe(true)
        expect(areStringArraysEqual(undefined, [])).toBe(true)
    })
})
