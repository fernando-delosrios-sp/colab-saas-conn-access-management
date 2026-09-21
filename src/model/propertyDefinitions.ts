import {
    EntitlementRefV2026,
    RequestabilityForRoleV2026,
    RequestabilityV2026,
    RoleMembershipSelectorV2026,
} from 'sailpoint-api-client'

export interface AccessProfileProperties {
    id?: string
    ownerId: string
    sourceId: string
    appName: string
    entitlements: EntitlementRefV2026[]
    requestable: boolean
    accessRequestConfig?: RequestabilityV2026
}

export interface RoleProperties {
    id?: string
    ownerId: string
    entitlements: EntitlementRefV2026[]
    requestable: boolean
    accessRequestConfig?: RequestabilityForRoleV2026
    membership?: RoleMembershipSelectorV2026
}

export interface ApplicationProperties {
    appId?: string
    sourceId: string
    accessProfiles: string[]
}
