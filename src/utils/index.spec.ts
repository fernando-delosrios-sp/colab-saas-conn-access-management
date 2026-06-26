import { normalizeAttributes } from './index'
import { EntitlementV2025 } from 'sailpoint-api-client'

describe('normalizeAttributes', () => {
    it('should normalize basic entitlement correctly', () => {
        const entitlement: EntitlementV2025 = {
            id: '123',
            name: 'Test Entitlement',
            value: 'test-value',
            source: {
                name: 'Test Source',
                id: 'src-123',
                type: 'SOURCE',
            },
            attributes: {
                customAttr: 'customValue',
            },
        }

        const result = normalizeAttributes(entitlement, 'test-group')

        expect(result).toEqual({
            id: '123',
            name: 'Test Entitlement',
            value: 'test-value',
            source: {
                name: 'Test Source',
                id: 'src-123',
                type: 'SOURCE',
            },
            attributes: {
                customAttr: 'customValue',
                name: 'Test Entitlement',
                value: 'test-value',
                _source: 'Test Source',
                _group: 'test-group',
            },
        })

        // original object shouldn't be mutated
        expect(entitlement.attributes).toEqual({ customAttr: 'customValue' })
    })

    it('should handle undefined source', () => {
        const entitlement: EntitlementV2025 = {
            id: '123',
            name: 'Test Entitlement',
            value: 'test-value',
            attributes: {},
        }

        const result = normalizeAttributes(entitlement, 'test-group')

        expect(result.attributes?._source).toBeUndefined()
    })

    it('should handle undefined attributes', () => {
        const entitlement: EntitlementV2025 = {
            id: '123',
            name: 'Test Entitlement',
            value: 'test-value',
        }

        const result = normalizeAttributes(entitlement, 'test-group')

        expect(result.attributes).toEqual({
            name: 'Test Entitlement',
            value: 'test-value',
            _source: undefined,
            _group: 'test-group',
        })
    })

    it('should handle undefined _group', () => {
        const entitlement: EntitlementV2025 = {
            id: '123',
            name: 'Test Entitlement',
            value: 'test-value',
            attributes: {},
        }

        const result = normalizeAttributes(entitlement, undefined)

        expect(result.attributes?._group).toBeUndefined()
    })

    it('should not overwrite existing attributes if not conflicting with normalized ones', () => {
        const entitlement: EntitlementV2025 = {
            id: '123',
            name: 'Test Entitlement',
            value: 'test-value',
            attributes: {
                description: 'test description',
                name: 'old-name', // This should be overwritten
            },
        }

        const result = normalizeAttributes(entitlement, 'group')

        expect(result.attributes?.description).toBe('test description')
        expect(result.attributes?.name).toBe('Test Entitlement')
    })
})
