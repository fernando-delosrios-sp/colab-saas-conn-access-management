import {
    AccessProfilesV2025Api,
    AccessProfilesV2025ApiCreateAccessProfileRequest,
    AccessProfilesV2025ApiListAccessProfilesRequest,
    AccessProfileV2025,
    AppsV2025Api,
    AppsV2025ApiCreateSourceAppRequest,
    AppsV2025ApiGetSourceAppRequest,
    AppsV2025ApiListAllSourceAppRequest,
    Configuration,
    ConfigurationParameters,
    EntitlementRefV2025,
    EntitlementsV2025Api,
    EntitlementsV2025ApiListEntitlementsRequest,
    EntitlementV2025,
    JsonPatchOperationV2025,
    Paginator,
    PublicIdentitiesConfigApi,
    PublicIdentityConfig,
    RequestabilityForRoleV2025,
    RequestabilityV2025,
    RoleMembershipSelectorV2025,
    RolesV2025Api,
    RolesV2025ApiCreateRoleRequest,
    RolesV2025ApiListRolesRequest,
    RoleV2025,
    SourceAppV2025,
    SourcesApi,
    SourcesV2025Api,
} from 'sailpoint-api-client'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import { TOKEN_URL_PATH } from './data/constants'
import { Config } from './model/config'
import { retriesConfig } from './axios'
import { escapeFilterString } from './utils/index'

export class ISCClient {
    private config: Configuration

    constructor(config: Config) {
        // Security enhancement: Validate config to prevent misconfiguration
        // and ensure secure transmission of credentials over HTTPS
        let isValidUrl = false
        if (config.baseurl) {
            try {
                const url = new URL(config.baseurl)
                if (
                    url.protocol === 'https:' ||
                    (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))
                ) {
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
        axiosRetry(axios as any, retriesConfig)
    }

    private async patchResource<T>(
        ApiClass: new (config: Configuration) => any,
        methodName: string,
        id: string,
        jsonPatchOperationV2025: JsonPatchOperationV2025[],
        additionalParams: Record<string, any> = {}
    ): Promise<T> {
        const api = new ApiClass(this.config)
        const requestParameters = {
            id,
            jsonPatchOperationV2025,
            ...additionalParams,
        }
        const response = await api[methodName](requestParameters)
        return response.data
    }

    async getPublicIdentityConfig(): Promise<PublicIdentityConfig> {
        const api = new PublicIdentitiesConfigApi(this.config)

        const response = await api.getPublicIdentityConfig()

        return response.data
    }

    async listSources() {
        const api = new SourcesApi(this.config)

        const response = await Paginator.paginate(api, api.listSources)

        return response.data
    }

    async listEntitlements(filters: string): Promise<EntitlementV2025[]> {
        const api = new EntitlementsV2025Api(this.config)
        const requestParameters: EntitlementsV2025ApiListEntitlementsRequest = {
            filters,
        }
        const response = await Paginator.paginate(api, api.listEntitlements, requestParameters)
        return response.data as EntitlementV2025[]
    }

    async getAccessProfileByName(name: string): Promise<AccessProfileV2025 | undefined> {
        const api = new AccessProfilesV2025Api(this.config)
        const filters = `name eq "${escapeFilterString(name)}"`
        const requestParameters: AccessProfilesV2025ApiListAccessProfilesRequest = {
            filters,
        }
        const response = await api.listAccessProfiles(requestParameters)
        return response.data[0] ? response.data[0] : undefined
    }

    async getRoleByName(name: string): Promise<RoleV2025 | undefined> {
        const api = new RolesV2025Api(this.config)
        const filters = `name eq "${escapeFilterString(name)}"`
        const requestParameters: RolesV2025ApiListRolesRequest = {
            filters,
        }
        const response = await api.listRoles(requestParameters)
        return response.data[0] ? response.data[0] : undefined
    }

    async getAppByName(name: string): Promise<SourceAppV2025 | undefined> {
        const api = new AppsV2025Api(this.config)
        const filters = `name eq "${escapeFilterString(name)}"`
        const requestParameters: AppsV2025ApiListAllSourceAppRequest = {
            filters,
        }

        const response = await api.listAllSourceApp(requestParameters)
        return response.data[0] ? response.data[0] : undefined
    }

    async createApp(name: string, sourceId: string): Promise<SourceAppV2025> {
        const api = new AppsV2025Api(this.config)
        const requestParameters: AppsV2025ApiCreateSourceAppRequest = {
            sourceAppCreateDtoV2025: {
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
        jsonPatchOperationV2025: JsonPatchOperationV2025[]
    ): Promise<SourceAppV2025> {
        return this.patchResource<SourceAppV2025>(AppsV2025Api, 'patchSourceApp', id, jsonPatchOperationV2025, {
            xSailPointExperimental: 'true',
        })
    }

    async getSource(id: string): Promise<SourceAppV2025> {
        const api = new SourcesV2025Api(this.config)
        const requestParameters: AppsV2025ApiGetSourceAppRequest = {
            id,
        }
        const response = await api.getSource(requestParameters)
        return response.data
    }

    async createAccessProfile(
        name: string,
        ownerId: string,
        sourceId: string,
        entitlements: EntitlementRefV2025[],
        requestable: boolean = false,
        accessRequestConfig?: RequestabilityV2025
    ): Promise<AccessProfileV2025> {
        const api = new AccessProfilesV2025Api(this.config)
        const requestParameters: AccessProfilesV2025ApiCreateAccessProfileRequest = {
            accessProfileV2025: {
                name,
                description: name,
                owner: {
                    id: ownerId,
                    type: 'IDENTITY',
                },
                source: {
                    id: sourceId,
                },
                enabled: true,
                entitlements,
                requestable,
            },
        }
        if (accessRequestConfig) requestParameters.accessProfileV2025.accessRequestConfig = accessRequestConfig
        const response = await api.createAccessProfile(requestParameters)
        return response.data
    }

    async updateAccessProfile(
        id: string,
        jsonPatchOperationV2025: JsonPatchOperationV2025[]
    ): Promise<AccessProfileV2025> {
        return this.patchResource<AccessProfileV2025>(
            AccessProfilesV2025Api,
            'patchAccessProfile',
            id,
            jsonPatchOperationV2025
        )
    }

    async createRole(
        name: string,
        ownerId: string,
        entitlements: EntitlementRefV2025[],
        requestable: boolean = false,
        accessRequestConfig?: RequestabilityForRoleV2025,
        membership?: RoleMembershipSelectorV2025
    ): Promise<RoleV2025> {
        const api = new RolesV2025Api(this.config)
        const requestParameters: RolesV2025ApiCreateRoleRequest = {
            roleV2025: {
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
        if (accessRequestConfig) requestParameters.roleV2025.accessRequestConfig = accessRequestConfig
        if (membership) requestParameters.roleV2025.membership = membership
        const response = await api.createRole(requestParameters)
        return response.data
    }

    async updateRole(id: string, jsonPatchOperationV2025: JsonPatchOperationV2025[]): Promise<RoleV2025> {
        return this.patchResource<RoleV2025>(RolesV2025Api, 'patchRole', id, jsonPatchOperationV2025)
    }
}
