import {
    EntitlementRefV2025,
    RequestabilityForRoleV2025,
    RequestabilityV2025,
    RoleMembershipSelectorV2025,
} from 'sailpoint-api-client'

export interface AccessProfileProperties {
    id?: string
    ownerId: string
    sourceId: string
    appName: string
    entitlements: EntitlementRefV2025[]
    requestable: boolean
    accessRequestConfig?: RequestabilityV2025
}

export interface RoleProperties {
    id?: string
    ownerId: string
    entitlements: EntitlementRefV2025[]
    requestable: boolean
    accessRequestConfig?: RequestabilityForRoleV2025
    membership?: RoleMembershipSelectorV2025
}

export interface ApplicationProperties {
    appId?: string
    sourceId: string
    accessProfiles: string[]
}
