import { areJsonEqual, escapeFilterString } from './index'

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

describe('escapeFilterString', () => {
    it('should return the original value if falsy', () => {
        expect(escapeFilterString('')).toBe('')
        expect(escapeFilterString(null as any)).toBe(null)
        expect(escapeFilterString(undefined as any)).toBe(undefined)
    })

    it('should return the original string if it contains no special characters', () => {
        expect(escapeFilterString('hello world')).toBe('hello world')
        expect(escapeFilterString('12345')).toBe('12345')
    })

    it('should escape backslashes', () => {
        expect(escapeFilterString('C:\\Windows\\System32')).toBe('C:\\\\Windows\\\\System32')
        expect(escapeFilterString('\\')).toBe('\\\\')
    })

    it('should escape double quotes', () => {
        expect(escapeFilterString('hello "world"')).toBe('hello \\"world\\"')
        expect(escapeFilterString('"')).toBe('\\"')
    })

    it('should escape both backslashes and double quotes', () => {
        expect(escapeFilterString('C:\\"Program Files"')).toBe('C:\\\\\\"Program Files\\"')
    })
})
