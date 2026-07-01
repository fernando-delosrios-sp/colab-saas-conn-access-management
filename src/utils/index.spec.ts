import { areJsonEqual } from './index'

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

import { normalizeAttributes } from './index'

describe('normalizeAttributes', () => {
    it('should correctly normalize all attributes', () => {
        const entitlement = {
            id: '123',
            name: 'ent1',
            value: 'val1',
            source: { id: 's1', name: 'source1', type: 'SOURCE' },
            attributes: { customAttr: 'customValue' },
            type: 'ENTITLEMENT',
        } as any

        const result = normalizeAttributes(entitlement, 'group1')

        expect(result.attributes).toEqual({
            customAttr: 'customValue',
            name: 'ent1',
            value: 'val1',
            _source: 'source1',
            _group: 'group1',
        })
        expect(result.id).toBe('123')
    })

    it('should handle undefined source', () => {
        const entitlement = {
            id: '123',
            name: 'ent1',
            value: 'val1',
            attributes: {},
            type: 'ENTITLEMENT',
        } as any

        const result = normalizeAttributes(entitlement, 'group1')

        expect(result.attributes!._source).toBeUndefined()
    })

    it('should handle undefined _group', () => {
        const entitlement = {
            id: '123',
            name: 'ent1',
            value: 'val1',
            source: { id: 's1', name: 'source1', type: 'SOURCE' },
            attributes: {},
            type: 'ENTITLEMENT',
        } as any

        const result = normalizeAttributes(entitlement, undefined)

        expect(result.attributes!._group).toBeUndefined()
    })

    it('should preserve existing attributes alongside new ones', () => {
        const entitlement = {
            id: '123',
            name: 'ent1',
            value: 'val1',
            source: { id: 's1', name: 'source1', type: 'SOURCE' },
            attributes: { existingKey: 'existingValue' },
            type: 'ENTITLEMENT',
        } as any

        const result = normalizeAttributes(entitlement, 'group1')

        expect(result.attributes!.existingKey).toBe('existingValue')
        expect(result.attributes!.name).toBe('ent1')
        expect(result.attributes!._source).toBe('source1')
    })

    it('should overwrite existing attributes if they collide with reserved keys', () => {
        const entitlement = {
            id: '123',
            name: 'ent1',
            value: 'val1',
            source: { id: 's1', name: 'source1', type: 'SOURCE' },
            attributes: { name: 'oldName', _source: 'oldSource' },
            type: 'ENTITLEMENT',
        } as any

        const result = normalizeAttributes(entitlement, 'group1')

        expect(result.attributes!.name).toBe('ent1')
        expect(result.attributes!._source).toBe('source1')
    })
})
