import { EntitlementRefV2025, RequestabilityV2025 } from 'sailpoint-api-client'

export interface AccessProfileDefinition {
    id?: string
    ownerId: string
    sourceId: string
    appName: string
    entitlements: EntitlementRefV2025[]
    requestable: boolean
    accessRequestConfig?: RequestabilityV2025
}

export interface ApplicationDefinition {
    appId?: string
    sourceId: string
    accessProfiles: string[]
}
