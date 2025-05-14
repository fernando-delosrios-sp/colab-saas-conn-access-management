import { EntitlementRefV2025, EntitlementV2025 } from 'sailpoint-api-client'
import { Definition } from './model/config'
import velocityjs from 'velocityjs'

export const normalizeAttributes = (entitlement: EntitlementV2025, _group: string | undefined): EntitlementV2025 => {
    const attributes = {
        ...entitlement.attributes,
        name: entitlement.name,
        value: entitlement.value,
        _source: entitlement.source?.name,
        _group,
    }

    return { ...entitlement, attributes }
}

export const buildAccessProfileName = (entitlement: EntitlementV2025, definition: Definition): string => {
    const template = velocityjs.parse(definition.apTemplate)

    const velocity = new velocityjs.Compile(template)
    const name = velocity.render(entitlement.attributes)

    return name
}

export const entitlementToRef = (entitlement: EntitlementV2025): EntitlementRefV2025 => {
    return {
        id: entitlement.id!,
        name: entitlement.name!,
        type: 'ENTITLEMENT',
    }
}
