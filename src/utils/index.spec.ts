import { entitlementToRef } from './index'
import { EntitlementV2025 } from 'sailpoint-api-client'

describe('entitlementToRef', () => {
    it('should map an entitlement to its ref representation', () => {
        const input: EntitlementV2025 = {
            id: 'ent-123',
            name: 'Group Admin',
            attributes: {},
        }

        const result = entitlementToRef(input)

        expect(result).toEqual({
            id: 'ent-123',
            name: 'Group Admin',
            type: 'ENTITLEMENT',
        })
    })

    it('should map correctly when optional properties are missing but id and name exist', () => {
        const input = {
            id: 'ent-456',
            name: 'User Role',
        } as EntitlementV2025

        const result = entitlementToRef(input)

        expect(result).toEqual({
            id: 'ent-456',
            name: 'User Role',
            type: 'ENTITLEMENT',
        })
    })
})
