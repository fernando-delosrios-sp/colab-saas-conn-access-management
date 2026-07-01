import { ISCClient } from './isc-client'
import {
    Configuration,
    PublicIdentitiesConfigApi,
    Paginator,
    SourcesApi,
    EntitlementsV2025Api,
    AccessProfilesV2025Api,
    RolesV2025Api,
    AppsV2025Api,
    SourcesV2025Api,
} from 'sailpoint-api-client'
import { Config } from './model/config'
import * as utils from './utils/index'

jest.mock('sailpoint-api-client')
jest.mock('axios')
jest.mock('axios-retry')

describe('ISCClient', () => {
    let client: ISCClient
    let mockConfig: Config

    beforeEach(() => {
        mockConfig = {
            baseurl: 'https://test.api.identitynow.com',
            clientId: 'client-id',
            clientSecret: 'client-secret',
            spConnectorInstanceId: 'instance-1',
            spConnectorSpecId: 'spec-1',
            spConnectorSupportsCustomSchemas: false,
        }
        client = new ISCClient(mockConfig)
        jest.clearAllMocks()
    })

    describe('constructor', () => {
        it('should initialize Configuration with correct parameters', () => {
            // Re-instantiate to test the constructor mock properly
            const mockConfigConst = {
                baseurl: 'https://test.api.identitynow.com',
                clientId: 'client-id',
                clientSecret: 'client-secret',
                spConnectorInstanceId: 'instance-1',
                spConnectorSpecId: 'spec-1',
                spConnectorSupportsCustomSchemas: false,
            }
            new ISCClient(mockConfigConst)

            expect(Configuration).toHaveBeenCalledWith(
                expect.objectContaining({
                    baseurl: mockConfigConst.baseurl,
                    clientId: mockConfigConst.clientId,
                    clientSecret: mockConfigConst.clientSecret,
                    tokenUrl: 'https://test.api.identitynow.com/oauth/token',
                })
            )
        })

        it('should throw an error if baseurl is http and not localhost', () => {
            const mockConfigConst = {
                baseurl: 'http://test.api.identitynow.com',
                clientId: 'client-id',
                clientSecret: 'client-secret',
                spConnectorInstanceId: 'instance-1',
                spConnectorSpecId: 'spec-1',
                spConnectorSupportsCustomSchemas: false,
            }

            expect(() => {
                new ISCClient(mockConfigConst)
            }).toThrow('Security Error: baseurl must use https:// to prevent unencrypted transmission of credentials')
        })

        it('should not throw an error if baseurl is http and localhost', () => {
            const mockConfigConst = {
                baseurl: 'http://localhost',
                clientId: 'client-id',
                clientSecret: 'client-secret',
                spConnectorInstanceId: 'instance-1',
                spConnectorSpecId: 'spec-1',
                spConnectorSupportsCustomSchemas: false,
            }

            expect(() => {
                new ISCClient(mockConfigConst)
            }).not.toThrow()
        })

        it('should not throw an error if baseurl is http and 127.0.0.1', () => {
            const mockConfigConst = {
                baseurl: 'http://127.0.0.1',
                clientId: 'client-id',
                clientSecret: 'client-secret',
                spConnectorInstanceId: 'instance-1',
                spConnectorSpecId: 'spec-1',
                spConnectorSupportsCustomSchemas: false,
            }

            expect(() => {
                new ISCClient(mockConfigConst)
            }).not.toThrow()
        })
    })

    describe('getPublicIdentityConfig', () => {
        it('should call getPublicIdentityConfig and return data', async () => {
            const mockApi = {
                getPublicIdentityConfig: jest.fn().mockResolvedValue({ data: { test: true } }),
            }
            ;(PublicIdentitiesConfigApi as jest.Mock).mockImplementation(() => mockApi)

            const result = await client.getPublicIdentityConfig()
            expect(result).toEqual({ test: true })
            expect(PublicIdentitiesConfigApi).toHaveBeenCalled()
            expect(mockApi.getPublicIdentityConfig).toHaveBeenCalled()
        })
    })

    describe('listSources', () => {
        it('should use Paginator to list sources', async () => {
            const mockApi = {
                listSources: jest.fn(),
            }
            ;(SourcesApi as jest.Mock).mockImplementation(() => mockApi)

            jest.spyOn(Paginator, 'paginate').mockResolvedValue({ data: [{ id: 'source-1' }] } as any)

            const result = await client.listSources()
            expect(result).toEqual([{ id: 'source-1' }])
            expect(Paginator.paginate).toHaveBeenCalledWith(mockApi, mockApi.listSources)
        })
    })

    describe('listEntitlements', () => {
        it('should use Paginator to list entitlements with filters', async () => {
            const mockApi = {
                listEntitlements: jest.fn(),
            }
            ;(EntitlementsV2025Api as jest.Mock).mockImplementation(() => mockApi)

            jest.spyOn(Paginator, 'paginate').mockResolvedValue({ data: [{ id: 'ent-1' }] } as any)

            const filters = 'name eq "test"'
            const result = await client.listEntitlements(filters)
            expect(result).toEqual([{ id: 'ent-1' }])
            expect(Paginator.paginate).toHaveBeenCalledWith(mockApi, mockApi.listEntitlements, { filters })
        })
    })

    describe('getAccessProfileByName', () => {
        it('should get access profile by name and return the first result', async () => {
            const mockApi = {
                listAccessProfiles: jest.fn().mockResolvedValue({ data: [{ id: 'ap-1' }] }),
            }
            ;(AccessProfilesV2025Api as jest.Mock).mockImplementation(() => mockApi)
            jest.spyOn(utils, 'escapeFilterString').mockReturnValue('escaped-name')

            const result = await client.getAccessProfileByName('test-name')
            expect(result).toEqual({ id: 'ap-1' })
            expect(mockApi.listAccessProfiles).toHaveBeenCalledWith({ filters: 'name eq "escaped-name"' })
            expect(utils.escapeFilterString).toHaveBeenCalledWith('test-name')
        })

        it('should return undefined if no access profile found', async () => {
            const mockApi = {
                listAccessProfiles: jest.fn().mockResolvedValue({ data: [] }),
            }
            ;(AccessProfilesV2025Api as jest.Mock).mockImplementation(() => mockApi)

            const result = await client.getAccessProfileByName('test-name')
            expect(result).toBeUndefined()
        })
    })

    describe('getRoleByName', () => {
        it('should get role by name and return the first result', async () => {
            const mockApi = {
                listRoles: jest.fn().mockResolvedValue({ data: [{ id: 'role-1' }] }),
            }
            ;(RolesV2025Api as jest.Mock).mockImplementation(() => mockApi)
            jest.spyOn(utils, 'escapeFilterString').mockReturnValue('escaped-role-name')

            const result = await client.getRoleByName('test-role')
            expect(result).toEqual({ id: 'role-1' })
            expect(mockApi.listRoles).toHaveBeenCalledWith({ filters: 'name eq "escaped-role-name"' })
        })
    })

    describe('getAppByName', () => {
        it('should get app by name and return the first result', async () => {
            const mockApi = {
                listAllSourceApp: jest.fn().mockResolvedValue({ data: [{ id: 'app-1' }] }),
            }
            ;(AppsV2025Api as jest.Mock).mockImplementation(() => mockApi)
            jest.spyOn(utils, 'escapeFilterString').mockReturnValue('escaped-app-name')

            const result = await client.getAppByName('test-app')
            expect(result).toEqual({ id: 'app-1' })
            expect(mockApi.listAllSourceApp).toHaveBeenCalledWith({ filters: 'name eq "escaped-app-name"' })
        })
    })

    describe('createApp', () => {
        it('should create an app', async () => {
            const mockApi = {
                createSourceApp: jest.fn().mockResolvedValue({ data: { id: 'new-app' } }),
            }
            ;(AppsV2025Api as jest.Mock).mockImplementation(() => mockApi)

            const result = await client.createApp('App Name', 'source-id')
            expect(result).toEqual({ id: 'new-app' })
            expect(mockApi.createSourceApp).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceAppCreateDtoV2025: {
                        name: 'App Name',
                        description: 'App Name',
                        accountSource: { id: 'source-id' },
                    },
                    xSailPointExperimental: 'true',
                })
            )
        })
    })

    describe('updateSourceAccessProfiles', () => {
        it('should update source access profiles via patch', async () => {
            const mockApi = {
                patchSourceApp: jest.fn().mockResolvedValue({ data: { id: 'patched-app' } }),
            }
            ;(AppsV2025Api as jest.Mock).mockImplementation(() => mockApi)

            const patch = [{ op: 'add', path: '/test', value: 'val' }] as any
            const result = await client.updateSourceAccessProfiles('app-id', patch)
            expect(result).toEqual({ id: 'patched-app' })
            expect(mockApi.patchSourceApp).toHaveBeenCalledWith({
                id: 'app-id',
                jsonPatchOperationV2025: patch,
                xSailPointExperimental: 'true',
            })
        })
    })

    describe('getSource', () => {
        it('should get source by id', async () => {
            const mockApi = {
                getSource: jest.fn().mockResolvedValue({ data: { id: 'source-1' } }),
            }
            ;(SourcesV2025Api as jest.Mock).mockImplementation(() => mockApi)

            const result = await client.getSource('source-1')
            expect(result).toEqual({ id: 'source-1' })
            expect(mockApi.getSource).toHaveBeenCalledWith({ id: 'source-1' })
        })
    })

    describe('createAccessProfile', () => {
        it('should create access profile', async () => {
            const mockApi = {
                createAccessProfile: jest.fn().mockResolvedValue({ data: { id: 'new-ap' } }),
            }
            ;(AccessProfilesV2025Api as jest.Mock).mockImplementation(() => mockApi)

            const entitlements = [{ type: 'ENTITLEMENT', id: 'ent-1' }] as any
            const result = await client.createAccessProfile('AP Name', 'owner-1', 'source-1', entitlements)

            expect(result).toEqual({ id: 'new-ap' })
            expect(mockApi.createAccessProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    accessProfileV2025: expect.objectContaining({
                        name: 'AP Name',
                        owner: { id: 'owner-1', type: 'IDENTITY' },
                        source: { id: 'source-1' },
                        entitlements,
                    }),
                })
            )
        })

        it('should create access profile with accessRequestConfig', async () => {
            const mockApi = {
                createAccessProfile: jest.fn().mockResolvedValue({ data: { id: 'new-ap' } }),
            }
            ;(AccessProfilesV2025Api as jest.Mock).mockImplementation(() => mockApi)

            const entitlements = [{ type: 'ENTITLEMENT', id: 'ent-1' }] as any
            const accessRequestConfig = { approvalSchemes: [] } as any
            const result = await client.createAccessProfile(
                'AP Name',
                'owner-1',
                'source-1',
                entitlements,
                true,
                accessRequestConfig
            )

            expect(result).toEqual({ id: 'new-ap' })
            expect(mockApi.createAccessProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    accessProfileV2025: expect.objectContaining({
                        name: 'AP Name',
                        owner: { id: 'owner-1', type: 'IDENTITY' },
                        source: { id: 'source-1' },
                        entitlements,
                        requestable: true,
                        accessRequestConfig,
                    }),
                })
            )
        })
    })

    describe('updateAccessProfile', () => {
        it('should patch access profile', async () => {
            const mockApi = {
                patchAccessProfile: jest.fn().mockResolvedValue({ data: { id: 'patched-ap' } }),
            }
            ;(AccessProfilesV2025Api as jest.Mock).mockImplementation(() => mockApi)

            const patch = [{ op: 'replace', path: '/description', value: 'new' }] as any
            const result = await client.updateAccessProfile('ap-id', patch)

            expect(result).toEqual({ id: 'patched-ap' })
            expect(mockApi.patchAccessProfile).toHaveBeenCalledWith({
                id: 'ap-id',
                jsonPatchOperationV2025: patch,
            })
        })
    })

    describe('createRole', () => {
        it('should create role', async () => {
            const mockApi = {
                createRole: jest.fn().mockResolvedValue({ data: { id: 'new-role' } }),
            }
            ;(RolesV2025Api as jest.Mock).mockImplementation(() => mockApi)

            const entitlements = [{ type: 'ENTITLEMENT', id: 'ent-1' }] as any
            const result = await client.createRole('Role Name', 'owner-1', entitlements)

            expect(result).toEqual({ id: 'new-role' })
            expect(mockApi.createRole).toHaveBeenCalledWith(
                expect.objectContaining({
                    roleV2025: expect.objectContaining({
                        name: 'Role Name',
                        owner: { id: 'owner-1', type: 'IDENTITY' },
                        entitlements,
                    }),
                })
            )
        })

        it('should create role with accessRequestConfig and membership', async () => {
            const mockApi = {
                createRole: jest.fn().mockResolvedValue({ data: { id: 'new-role' } }),
            }
            ;(RolesV2025Api as jest.Mock).mockImplementation(() => mockApi)

            const entitlements = [{ type: 'ENTITLEMENT', id: 'ent-1' }] as any
            const accessRequestConfig = { approvalSchemes: [] } as any
            const membership = { type: 'STANDARD' } as any
            const result = await client.createRole(
                'Role Name',
                'owner-1',
                entitlements,
                true,
                accessRequestConfig,
                membership
            )

            expect(result).toEqual({ id: 'new-role' })
            expect(mockApi.createRole).toHaveBeenCalledWith(
                expect.objectContaining({
                    roleV2025: expect.objectContaining({
                        name: 'Role Name',
                        owner: { id: 'owner-1', type: 'IDENTITY' },
                        entitlements,
                        requestable: true,
                        accessRequestConfig,
                        membership,
                    }),
                })
            )
        })
    })

    describe('updateRole', () => {
        it('should patch role', async () => {
            const mockApi = {
                patchRole: jest.fn().mockResolvedValue({ data: { id: 'patched-role' } }),
            }
            ;(RolesV2025Api as jest.Mock).mockImplementation(() => mockApi)

            const patch = [{ op: 'replace', path: '/description', value: 'new' }] as any
            const result = await client.updateRole('role-id', patch)

            expect(result).toEqual({ id: 'patched-role' })
            expect(mockApi.patchRole).toHaveBeenCalledWith({
                id: 'role-id',
                jsonPatchOperationV2025: patch,
            })
        })
    })
})
