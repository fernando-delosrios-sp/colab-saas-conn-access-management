import { areJsonEqual, getErrorMessage } from './index'

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

describe('getErrorMessage', () => {
    it('should return error.message if error is an instance of Error', () => {
        const error = new Error('This is an error message')
        expect(getErrorMessage(error)).toBe('This is an error message')
    })

    it('should return the stringified message property if error is an object with a message property', () => {
        const error = { message: 'Object error message' }
        expect(getErrorMessage(error)).toBe('Object error message')
    })

    it('should return the string if error is a string', () => {
        const error = 'String error message'
        expect(getErrorMessage(error)).toBe('String error message')
    })

    it('should return "An unknown error occurred" if error is null', () => {
        expect(getErrorMessage(null)).toBe('An unknown error occurred')
    })

    it('should return "An unknown error occurred" if error is undefined', () => {
        expect(getErrorMessage(undefined)).toBe('An unknown error occurred')
    })

    it('should return "An unknown error occurred" if error is a number', () => {
        expect(getErrorMessage(42)).toBe('An unknown error occurred')
    })

    it('should return "An unknown error occurred" if error is a boolean', () => {
        expect(getErrorMessage(true)).toBe('An unknown error occurred')
    })

    it('should return "An unknown error occurred" if error is an empty object without a message property', () => {
        expect(getErrorMessage({})).toBe('An unknown error occurred')
    })
})
