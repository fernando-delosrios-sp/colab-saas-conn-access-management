import {
    AccessProfilesV2026Api,
    AccessProfilesV2026ApiCreateAccessProfileRequest,
    AccessProfilesV2026ApiListAccessProfilesRequest,
    AccessProfileV2026,
    AppsV2026Api,
    AppsV2026ApiCreateSourceAppRequest,
    AppsV2026ApiGetSourceAppRequest,
    AppsV2026ApiListAccessProfilesForSourceAppRequest,
    AppsV2026ApiListAllSourceAppRequest,
    Configuration,
    ConfigurationParameters,
    EntitlementBulkUpdateRequestV2026,
    EntitlementRefV2026,
    EntitlementRequestConfigV2026,
    EntitlementsV2026Api,
    EntitlementsV2026ApiListEntitlementsRequest,
    EntitlementsV2026ApiPutEntitlementRequestConfigRequest,
    EntitlementsV2026ApiUpdateEntitlementsInBulkRequest,
    EntitlementV2026,
    JsonPatchOperationV2026,
    Paginator,
    PublicIdentitiesConfigV2026Api,
    PublicIdentityConfigV2026,
    RequestabilityForRoleV2026,
    RequestabilityV2026,
    RoleMembershipSelectorV2026,
    RolesV2026Api,
    RolesV2026ApiCreateRoleRequest,
    RolesV2026ApiListRolesRequest,
    RoleV2026,
    SearchV2026,
    SearchV2026Api,
    SourceAppV2026,
    SourcesV2026Api,
} from 'sailpoint-api-client'
import { logger } from '@sailpoint/connector-sdk'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import { TOKEN_URL_PATH } from './data/constants'
import { Config } from './model/config'
import { retriesConfig } from './axios'
import { escapeFilterString, processConcurrent } from './utils/index'
import { throttle } from './utils/throttle'

// Lightweight types for search results - only keep essential fields to reduce memory
export interface LightweightAccessProfile {
    id: string
    name: string
    entitlements?: Array<{ id?: string | null }> | null
    requestable?: boolean
    accessRequestConfig?: unknown
    enabled?: boolean
    app?: {
        id?: string
        name?: string
        accountSource?: { id?: string } | null
    }
}

export interface LightweightRole {
    id: string
    name: string
    entitlements?: Array<{ id?: string | null }> | null
    requestable?: boolean
    accessRequestConfig?: unknown
    membership?: unknown
    enabled?: boolean
}

export class ISCClient {
    private config: Configuration
    private static throttleInterceptorId: number | null = null

    constructor(config: Config) {
        // Security enhancement: Validate config to prevent misconfiguration
        // and ensure secure transmission of credentials over HTTPS
        let isValidUrl = false
        if (config.baseurl) {
            try {
                const url = new URL(config.baseurl)
                if (url.protocol === 'https:') {
                    isValidUrl = true
                }
            } catch (e) {
                // Invalid URL
            }
        }

        if (!isValidUrl) {
            throw new Error(
                'Security Error: baseurl must use https:// to prevent unencrypted transmission of credentials'
            )
        }
        if (!config.clientId || !config.clientSecret) {
            throw new Error('Security Error: Missing required authentication credentials in configuration')
        }

        const conf: ConfigurationParameters = {
            baseurl: config.baseurl,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            tokenUrl: new URL(config.baseurl).origin + TOKEN_URL_PATH,
        }
        this.config = new Configuration(conf)
        this.config.retriesConfig = retriesConfig
        this.config.experimental = true
        // Security enhancement: Add timeout to prevent resource exhaustion from hanging API requests
        this.config.baseOptions = { ...this.config.baseOptions, timeout: 30000 } // 30 seconds
        axiosRetry(axios as any, retriesConfig)

        // Throttle: 100 requests per 10 seconds (ISC rate limit)
        if (ISCClient.throttleInterceptorId === null) {
            ISCClient.throttleInterceptorId = axios.interceptors.request.use(
                async (config) => {
                    await throttle()
                    return config
                },
                (error) => Promise.reject(error)
            )
        }
    }

    private async patchResource<T>(
        ApiClass: new (config: Configuration) => any,
        methodName: string,
        id: string,
        jsonPatchOperationV2026: JsonPatchOperationV2026[],
        additionalParams: Record<string, any> = {}
    ): Promise<T> {
        const api = new ApiClass(this.config)
        const requestParameters = {
            id,
            jsonPatchOperationV2026,
            ...additionalParams,
        }
        const response = await api[methodName](requestParameters)
        return response.data
    }

    async getPublicIdentityConfig(): Promise<PublicIdentityConfigV2026> {
        const api = new PublicIdentitiesConfigV2026Api(this.config)

        const response = await api.getPublicIdentityConfig()

        return response.data
    }

    async listSources() {
        const api = new SourcesV2026Api(this.config)

        const response = await Paginator.paginate(api, api.listSources)

        return response.data
    }

    async listEntitlements(filters: string): Promise<EntitlementV2026[]> {
        const api = new EntitlementsV2026Api(this.config)
        const requestParameters: EntitlementsV2026ApiListEntitlementsRequest = {
            filters,
        }
        const response = await Paginator.paginate(api, api.listEntitlements, requestParameters)
        return response.data as EntitlementV2026[]
    }

    async getAccessProfileByName(name: string): Promise<AccessProfileV2026 | undefined> {
        const api = new AccessProfilesV2026Api(this.config)
        const filters = `name eq "${escapeFilterString(name)}"`
        const requestParameters: AccessProfilesV2026ApiListAccessProfilesRequest = {
            filters,
        }
        const response = await api.listAccessProfiles(requestParameters)
        return response.data[0] ? response.data[0] : undefined
    }

    async getAccessProfilesByNames(names: string[]): Promise<AccessProfileV2026[]> {
        const api = new AccessProfilesV2026Api(this.config)

        // Chunk names to avoid URI too long errors
        const chunkSize = 30
        const chunks: string[][] = []
        for (let i = 0; i < names.length; i += chunkSize) {
            chunks.push(names.slice(i, i + chunkSize))
        }

        const results = await processConcurrent(chunks, async (chunk) => {
            const escapedNames = chunk.map((name) => `"${escapeFilterString(name)}"`).join(', ')
            const filters = `name in (${escapedNames})`
            const requestParameters: AccessProfilesV2026ApiListAccessProfilesRequest = {
                filters,
            }
            const response = await api.listAccessProfiles(requestParameters)
            return response.data
        })

        return results.flat()
    }

    async getRoleByName(name: string): Promise<RoleV2026 | undefined> {
        const api = new RolesV2026Api(this.config)
        const filters = `name eq "${escapeFilterString(name)}"`
        const requestParameters: RolesV2026ApiListRolesRequest = {
            filters,
        }
        const response = await api.listRoles(requestParameters)
        return response.data[0] ? response.data[0] : undefined
    }

    async getRolesByNames(names: string[]): Promise<RoleV2026[]> {
        const api = new RolesV2026Api(this.config)

        const chunkSize = 30
        const chunks: string[][] = []
        for (let i = 0; i < names.length; i += chunkSize) {
            chunks.push(names.slice(i, i + chunkSize))
        }

        const results = await processConcurrent(chunks, async (chunk) => {
            const escapedNames = chunk.map((name) => `"${escapeFilterString(name)}"`).join(', ')
            const filters = `name in (${escapedNames})`
            const requestParameters: RolesV2026ApiListRolesRequest = {
                filters,
            }
            const response = await api.listRoles(requestParameters)
            return response.data
        })

        return results.flat()
    }

    async getAppsByNames(names: string[]): Promise<SourceAppV2026[]> {
        const api = new AppsV2026Api(this.config)

        const chunkSize = 30
        const chunks: string[][] = []
        for (let i = 0; i < names.length; i += chunkSize) {
            chunks.push(names.slice(i, i + chunkSize))
        }

        const results = await processConcurrent(chunks, async (chunk) => {
            const escapedNames = chunk.map((name) => `"${escapeFilterString(name)}"`).join(', ')
            const filters = `name in (${escapedNames})`
            const requestParameters: AppsV2026ApiListAllSourceAppRequest = {
                filters,
            }
            const response = await api.listAllSourceApp(requestParameters)
            return response.data
        })

        return results.flat()
    }

    async getAppByName(name: string): Promise<SourceAppV2026 | undefined> {
        const api = new AppsV2026Api(this.config)
        const filters = `name eq "${escapeFilterString(name)}"`
        const requestParameters: AppsV2026ApiListAllSourceAppRequest = {
            filters,
        }

        const response = await api.listAllSourceApp(requestParameters)
        return response.data[0] ? response.data[0] : undefined
    }

    async getAppById(id: string): Promise<SourceAppV2026> {
        const api = new AppsV2026Api(this.config)
        const requestParameters: AppsV2026ApiGetSourceAppRequest = {
            id,
            xSailPointExperimental: 'true',
        }
        const response = await api.getSourceApp(requestParameters)
        return response.data
    }

    async getAppAccessProfiles(appId: string): Promise<string[]> {
        const api = new AppsV2026Api(this.config)
        const requestParameters: AppsV2026ApiListAccessProfilesForSourceAppRequest = {
            id: appId,
            xSailPointExperimental: 'true',
        }
        const response = await api.listAccessProfilesForSourceApp(requestParameters)
        return response.data.map((ap: any) => ap.id).filter(Boolean)
    }

    async createApp(name: string, sourceId: string): Promise<SourceAppV2026> {
        const api = new AppsV2026Api(this.config)
        const requestParameters: AppsV2026ApiCreateSourceAppRequest = {
            sourceAppCreateDtoV2026: {
                name,
                description: name,
                accountSource: {
                    id: sourceId,
                },
            },
            xSailPointExperimental: 'true',
        }
        const response = await api.createSourceApp(requestParameters)
        return response.data
    }

    async updateSourceAccessProfiles(
        id: string,
        jsonPatchOperationV2026: JsonPatchOperationV2026[]
    ): Promise<SourceAppV2026> {
        return this.patchResource<SourceAppV2026>(AppsV2026Api, 'patchSourceApp', id, jsonPatchOperationV2026, {
            xSailPointExperimental: 'true',
        })
    }

    async getSource(id: string): Promise<SourceAppV2026> {
        const api = new SourcesV2026Api(this.config)
        const requestParameters: AppsV2026ApiGetSourceAppRequest = {
            id,
        }
        const response = await api.getSource(requestParameters)
        return response.data
    }

    async createAccessProfile(
        name: string,
        ownerId: string,
        sourceId: string,
        entitlements: EntitlementRefV2026[],
        requestable: any = false,
        accessRequestConfig?: RequestabilityV2026
    ): Promise<AccessProfileV2026> {
        const isRequestable = requestable === true || String(requestable) === 'true'
        const api = new AccessProfilesV2026Api(this.config)
        const requestParameters: AccessProfilesV2026ApiCreateAccessProfileRequest = {
            accessProfileV2026: {
                name,
                description: name,
                owner: {
                    id: ownerId,
                    type: 'IDENTITY',
                },
                source: {
                    id: sourceId,
                    type: 'SOURCE',
                },
                enabled: true,
                entitlements,
                requestable: isRequestable,
            },
        }
        if (accessRequestConfig && isRequestable) requestParameters.accessProfileV2026.accessRequestConfig = accessRequestConfig
        
        console.log(`[ISCClient] createAccessProfile payload: ${JSON.stringify(requestParameters, null, 2)}`)
        
        const response = await api.createAccessProfile(requestParameters)
        return response.data
    }

    async updateAccessProfile(
        id: string,
        jsonPatchOperationV2026: JsonPatchOperationV2026[]
    ): Promise<AccessProfileV2026> {
        return this.patchResource<AccessProfileV2026>(
            AccessProfilesV2026Api,
            'patchAccessProfile',
            id,
            jsonPatchOperationV2026
        )
    }

    async createRole(
        name: string,
        ownerId: string,
        entitlements: EntitlementRefV2026[],
        requestable: boolean = false,
        accessRequestConfig?: RequestabilityForRoleV2026,
        membership?: RoleMembershipSelectorV2026
    ): Promise<RoleV2026> {
        const api = new RolesV2026Api(this.config)
        const requestParameters: RolesV2026ApiCreateRoleRequest = {
            roleV2026: {
                name,
                description: name,
                owner: {
                    id: ownerId,
                    type: 'IDENTITY',
                },
                requestable,
                entitlements,
                accessRequestConfig,
                enabled: true,
            },
        }
        if (accessRequestConfig) requestParameters.roleV2026.accessRequestConfig = accessRequestConfig
        if (membership) requestParameters.roleV2026.membership = membership
        const response = await api.createRole(requestParameters)
        return response.data
    }

    async updateRole(id: string, jsonPatchOperationV2026: JsonPatchOperationV2026[]): Promise<RoleV2026> {
        return this.patchResource<RoleV2026>(RolesV2026Api, 'patchRole', id, jsonPatchOperationV2026)
    }

    /**
     * Bulk update entitlements (requestable, privileged, etc.). Max 50 entitlements per request.
     * @see https://developer.sailpoint.com/docs/api/v2026/update-entitlements-in-bulk
     */
    async updateEntitlementsInBulk(
        entitlementIds: string[],
        jsonPatch: JsonPatchOperationV2026[]
    ): Promise<void> {
        const api = new EntitlementsV2026Api(this.config)
        const body: EntitlementBulkUpdateRequestV2026 = {
            entitlementIds,
            jsonPatch,
        }
        const requestParameters: EntitlementsV2026ApiUpdateEntitlementsInBulkRequest = {
            entitlementBulkUpdateRequestV2026: body,
        }
        await api.updateEntitlementsInBulk(requestParameters)
    }

    /**
     * Replace entitlement request config (approval schemes) for a single entitlement.
     * @see https://developer.sailpoint.com/docs/api/v2026/put-entitlement-request-config
     */
    async putEntitlementRequestConfig(
        id: string,
        entitlementRequestConfigV2026: EntitlementRequestConfigV2026
    ): Promise<EntitlementRequestConfigV2026> {
        const api = new EntitlementsV2026Api(this.config)
        const requestParameters: EntitlementsV2026ApiPutEntitlementRequestConfigRequest = {
            id,
            entitlementRequestConfigV2026,
        }
        const response = await api.putEntitlementRequestConfig(requestParameters)
        return response.data
    }

    /**
     * List access profiles filtered by source IDs. Uses source.id in ("id1","id2") filter.
     */
    async listAccessProfilesBySources(sourceIds: string[]): Promise<AccessProfileV2026[]> {
        if (sourceIds.length === 0) return []
        const api = new AccessProfilesV2026Api(this.config)
        const filterValue = sourceIds.map((id) => `"${id}"`).join(',')
        const filters = `source.id in (${filterValue})`
        const requestParameters: AccessProfilesV2026ApiListAccessProfilesRequest = { filters }
        const response = await Paginator.paginate(api, api.listAccessProfiles as any, requestParameters)
        return response.data as AccessProfileV2026[]
    }

    /**
     * List source apps filtered by account source IDs.
     */
    async listAppsBySources(sourceIds: string[]): Promise<SourceAppV2026[]> {
        if (sourceIds.length === 0) return []
        const api = new AppsV2026Api(this.config)
        const filterValue = sourceIds.map((id) => `"${id}"`).join(',')
        const filters = `accountSource.id in (${filterValue})`
        const requestParameters: AppsV2026ApiListAllSourceAppRequest = {
            filters,
            xSailPointExperimental: 'true',
        }
        const response = await Paginator.paginate(api, api.listAllSourceApp as any, requestParameters)
        return response.data as SourceAppV2026[]
    }

    /**
     * List roles filtered by owner IDs.
     */
    async listRolesByOwners(ownerIds: string[]): Promise<RoleV2026[]> {
        if (ownerIds.length === 0) return []
        const api = new RolesV2026Api(this.config)
        const filterValue = ownerIds.map((id) => `"${id}"`).join(',')
        const filters = `owner.id in (${filterValue})`
        const requestParameters: RolesV2026ApiListRolesRequest = { filters }
        const response = await Paginator.paginate(api, api.listRoles as any, requestParameters)
        return response.data as RoleV2026[]
    }

    async deleteAccessProfile(id: string): Promise<void> {
        const api = new AccessProfilesV2026Api(this.config)
        await api.deleteAccessProfile({ id })
    }

    async deleteRole(id: string): Promise<void> {
        const api = new RolesV2026Api(this.config)
        await api.deleteRole({ id })
    }

    async deleteSourceApp(id: string): Promise<void> {
        const api = new AppsV2026Api(this.config)
        await api.deleteSourceApp({ id, xSailPointExperimental: 'true' })
    }

    /**
     * Search for access profiles by entitlement IDs using the Search API.
     * Batches up to 10 entitlements per query for efficiency.
     * Returns only essential fields to minimize memory usage.
     * @param entitlementIds List of entitlement IDs to search for
     * @returns Lightweight access profiles with only essential fields
     */
    async searchAccessProfilesByEntitlements(entitlementIds: string[]): Promise<LightweightAccessProfile[]> {
        if (entitlementIds.length === 0) return []
        const api = new SearchV2026Api(this.config)
        const results: LightweightAccessProfile[] = []
        const BATCH_SIZE = 10
        for (let i = 0; i < entitlementIds.length; i += BATCH_SIZE) {
            const batch = entitlementIds.slice(i, i + BATCH_SIZE)
            const query = batch.map((id) => `@entitlements(id:${id})`).join(' OR ')
            const searchRequest: SearchV2026 = {
                indices: ['accessprofiles' as any],
                query: { query } as any,
            }
            const response = await api.searchPost({ searchV2026: searchRequest })
            const accessProfiles = response.data as any[]
            
            for (const ap of accessProfiles) {
                if (ap.id && ap.name) {
                    results.push({
                        id: ap.id,
                        name: ap.name,
                        entitlements: ap.entitlements,
                        requestable: ap.requestable,
                        accessRequestConfig: ap.accessRequestConfig,
                        enabled: ap.enabled,
                        app: ap.app
                            ? {
                                  id: ap.app.id,
                                  name: ap.app.name,
                                  accountSource: ap.app.accountSource,
                              }
                            : undefined,
                    })
                }
            }
        }
        return results
    }

    /**
     * Search for roles by entitlement IDs using the Search API.
     * Batches up to 10 entitlements per query for efficiency.
     * Returns only essential fields to minimize memory usage.
     * @param entitlementIds List of entitlement IDs to search for
     * @returns Lightweight roles with only essential fields
     */
    async searchRolesByEntitlements(entitlementIds: string[]): Promise<LightweightRole[]> {
        if (entitlementIds.length === 0) return []
        const api = new SearchV2026Api(this.config)
        const results: LightweightRole[] = []
        const BATCH_SIZE = 10
        for (let i = 0; i < entitlementIds.length; i += BATCH_SIZE) {
            const batch = entitlementIds.slice(i, i + BATCH_SIZE)
            const query = batch.map((id) => `@entitlements(id:${id})`).join(' OR ')
            logger.debug(`Role search query batch ${i / BATCH_SIZE + 1}: ${query}`)
            const searchRequest: SearchV2026 = {
                indices: ['roles' as any],
                query: { query } as any,
            }
            const response = await api.searchPost({ searchV2026: searchRequest })
            const roles = response.data as any[]
            logger.debug(`Role search batch ${i / BATCH_SIZE + 1} returned ${roles.length} roles${roles.length > 0 ? ': ' + roles.map((r: any) => r.name).join(', ') : ''}`)
            
            for (const role of roles) {
                if (role.id && role.name) {
                    results.push({
                        id: role.id,
                        name: role.name,
                        entitlements: role.entitlements,
                        requestable: role.requestable,
                        accessRequestConfig: role.accessRequestConfig,
                        membership: role.membership,
                        enabled: role.enabled,
                    })
                }
            }
        }
        return results
    }

    /**
     * Fallback: Search for access profiles by exact name matches using the dedicated API.
     * Used when Search API returns no results (e.g., for special sources).
     * @param names Array of exact access profile names to search for
     * @returns Lightweight access profiles matching the given names
     */
    async searchAccessProfilesByNames(names: string[]): Promise<LightweightAccessProfile[]> {
        if (names.length === 0) return []
        logger.debug(`Fallback: Searching access profiles by name (${names.length} names)`)
        const api = new AccessProfilesV2026Api(this.config)
        const results: LightweightAccessProfile[] = []
        
        const response = await Paginator.paginate(api, api.listAccessProfiles as any, {})
        const allAccessProfiles = response.data as any[]
        
        for (const accessProfile of allAccessProfiles) {
            if (accessProfile.name && names.includes(accessProfile.name)) {
                results.push({
                    id: accessProfile.id!,
                    name: accessProfile.name,
                    entitlements: accessProfile.entitlements,
                    requestable: accessProfile.requestable,
                    accessRequestConfig: accessProfile.accessRequestConfig,
                    enabled: accessProfile.enabled,
                    app: accessProfile.app
                        ? {
                              id: accessProfile.app.id,
                              name: accessProfile.app.name,
                              accountSource: accessProfile.app.accountSource,
                          }
                        : undefined,
                })
            }
        }
        logger.debug(`Fallback: Found ${results.length} access profiles by name: ${results.map(ap => ap.name).join(', ')}`)
        return results
    }

    /**
     * Fallback: Search for roles by exact name matches using the dedicated API.
     * Used when Search API returns no results (e.g., for special sources).
     * @param names Array of exact role names to search for
     * @returns Lightweight roles matching the given names
     */
    async searchRolesByNames(names: string[]): Promise<LightweightRole[]> {
        if (names.length === 0) return []
        logger.debug(`Fallback: Searching roles by name (${names.length} names)`)
        const api = new RolesV2026Api(this.config)
        const results: LightweightRole[] = []
        
        const response = await Paginator.paginate(api, api.listRoles as any, {})
        const allRoles = response.data as RoleV2026[]
        
        for (const role of allRoles) {
            if (role.name && names.includes(role.name)) {
                results.push({
                    id: role.id!,
                    name: role.name,
                    entitlements: role.entitlements,
                    requestable: role.requestable,
                    accessRequestConfig: role.accessRequestConfig,
                    membership: role.membership,
                    enabled: role.enabled,
                })
            }
        }
        logger.debug(`Fallback: Found ${results.length} roles by name: ${results.map(r => r.name).join(', ')}`)
        return results
    }
}
