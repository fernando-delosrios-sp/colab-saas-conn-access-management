import { logger, ConnectorError } from '@sailpoint/connector-sdk'
import { Config } from './model/config'
import { ISCClient } from './isc-client'
import {
    AccessProfileV2025,
    EntitlementV2025,
    JsonPatchOperationV2025,
    RoleV2025,
    SourceAppV2025,
} from 'sailpoint-api-client'
import { AccessProfileProperties, ApplicationProperties, RoleProperties } from './model/propertyDefinitions'
import {
    areEntitlementRefsEqual,
    areJsonEqual,
    areStringArraysEqual,
    buildName,
    entitlementToRef,
    getErrorMessage,
    normalizeAttributes,
    stringToMembership,
} from './utils'

export const processAccessProfiles = async (config: Config, isc: ISCClient) => {
    if (config.accessProfiles) {
        logger.debug(`Processing ${config.accessProfiles.length} accessProfiles`)
        const applicationMap = new Map<string, ApplicationProperties>()
        const accessProfileMap = new Map<string, AccessProfileProperties>()
        const entitlementMap = new Map<string, EntitlementV2025[]>()
        const existingAccessProfileMap = new Map<string, AccessProfileV2025>()
        const existingAppMap = new Map<string, SourceAppV2025>()
        // ⚡ Bolt: Cache source owners to avoid N+1 API calls for identical source IDs
        const sourceOwnerMap = new Map<string, string>()
        // Process each definition
        accessProfiles: for (const definition of config.accessProfiles) {
            logger.debug(`Processing definition: ${definition.name}`)
            const entitlements = await isc.listEntitlements(definition.query)
            logger.debug(`Found ${entitlements.length} entitlements for definition ${definition.name}`)
            // Get entitlements, access profiles, and applications from each entitlement found
            entitlements: for (let entitlement of entitlements) {
                logger.debug(`Processing entitlement: ${entitlement.name} (${entitlement.id})`)
                if (definition.groupByAttribute) {
                    if (definition.groupType === 'application') {
                        const attributeName = definition.groupAttribute
                        if (attributeName) {
                            let attributeValue: string | undefined
                            entitlement = normalizeAttributes(entitlement, undefined)
                            attributeValue = entitlement.attributes![attributeName]
                            entitlement.attributes!._group = attributeValue
                            if (attributeValue) {
                                logger.debug(`Grouping by application for entitlement ${entitlement.name}`)
                                if (!entitlementMap.has(attributeValue)) {
                                    entitlementMap.set(attributeValue, [])
                                }
                                entitlementMap.get(attributeValue)?.push(entitlement)
                            } else {
                                logger.error(`Entitlement ${entitlement.name} has no ${attributeName} attribute`)
                                continue entitlements
                            }
                        } else {
                            logger.error(`Definition ${definition.name} has no groupAttribute defined`)
                            continue accessProfiles
                        }
                    } else {
                        entitlement = normalizeAttributes(entitlement, definition.name)
                        const name = entitlement.attributes![definition.groupAttribute!]
                        if (name) {
                            logger.debug(`Grouping by attribute ${definition.groupAttribute} with value ${name}`)
                            if (!entitlementMap.has(definition.name)) {
                                entitlementMap.set(definition.name, [])
                            }
                            entitlementMap.get(definition.name)?.push(entitlement)
                        } else {
                            logger.error(`Entitlement ${entitlement.id} has no ${definition.groupAttribute} attribute`)
                        }
                    }
                } else {
                    logger.debug(`No grouping defined for entitlement ${entitlement.name}`)
                    entitlement = normalizeAttributes(entitlement, definition.name)
                    if (!entitlementMap.has(definition.name)) {
                        entitlementMap.set(definition.name, [])
                    }
                    entitlementMap.get(definition.name)?.push(entitlement)
                }
            }
            groups: for (const groupName of entitlementMap.keys()) {
                logger.debug(`Processing group: ${groupName}`)
                let sourceId: string
                let ownerId: string | undefined
                let app: SourceAppV2025 | undefined

                entitlements: for (const entitlement of entitlementMap.get(groupName)!) {
                    logger.debug(`Processing entitlement in group: ${entitlement.name}`)
                    const entitlementRef = entitlementToRef(entitlement)
                    sourceId = entitlement.source!.id!
                    if (!ownerId) {
                        if (sourceOwnerMap.has(sourceId)) {
                            ownerId = sourceOwnerMap.get(sourceId)!
                        } else {
                            ownerId = (await isc.getSource(sourceId)).owner!.id!
                            sourceOwnerMap.set(sourceId, ownerId)
                        }
                    }
                    const appName = definition.groupType === 'accessProfile' ? definition.name : groupName
                    if (definition.createApplication) {
                        if (!applicationMap.has(appName)) {
                            logger.debug(`Looking up app: ${appName}`)
                            app = await isc.getAppByName(appName)
                            if (app) {
                                if (app.accountSource?.id !== sourceId) {
                                    logger.error(
                                        `Found app ${appName} with different source than ${entitlement.source?.name}`
                                    )
                                    continue groups
                                }
                                existingAppMap.set(app.name!, app)
                                applicationMap.set(app.name!, { appId: app.id!, sourceId, accessProfiles: [] })
                            } else {
                                applicationMap.set(appName, { sourceId, accessProfiles: [] })
                            }
                        }
                    }

                    const name = buildName(entitlement, definition)
                    logger.debug(`Preparing access profile: ${name}`)
                    let accessProfileProperties: AccessProfileProperties
                    if (accessProfileMap.has(name)) {
                        accessProfileProperties = accessProfileMap.get(name)!
                        accessProfileProperties.entitlements.push(entitlementRef)
                    } else {
                        accessProfileProperties = {
                            appName,
                            ownerId,
                            sourceId,
                            entitlements: [entitlementRef],
                            requestable: definition.requestable,
                        }
                        if (definition.approverType) {
                            accessProfileProperties.accessRequestConfig = {
                                approvalSchemes: [
                                    {
                                        approverType: definition.approverType,
                                    },
                                ],
                            }
                        }

                        logger.debug(`Checking for existing access profile: ${name}`)
                        const existingAp = await isc.getAccessProfileByName(name)
                        if (existingAp) {
                            existingAccessProfileMap.set(name, existingAp)
                            accessProfileProperties.id = existingAp.id
                        }
                        accessProfileMap.set(name, accessProfileProperties)
                    }
                }
            }
        }

        // Create/update access profiles
        for (const [apName, ap] of accessProfileMap.entries()) {
            const { id, appName, ownerId, sourceId, entitlements, requestable, accessRequestConfig } = ap
            let accessProfile: AccessProfileV2025
            if (id) {
                logger.debug(`Evaluating existing access profile for update: ${apName}`)
                const existingAp = existingAccessProfileMap.get(apName)
                const accessProfileUpdate: JsonPatchOperationV2025[] = [
                    {
                        op: 'replace',
                        path: '/entitlements',
                        value: entitlements,
                    },
                ]
                if (requestable) {
                    accessProfileUpdate.push({
                        op: 'replace',
                        path: '/requestable',
                        value: true,
                    })
                }
                if (accessRequestConfig) {
                    accessProfileUpdate.push({
                        op: 'replace',
                        path: '/accessRequestConfig',
                        value: accessRequestConfig,
                    })
                }

                if (existingAp) {
                    const entitlementsChanged = !areEntitlementRefsEqual(existingAp.entitlements, entitlements)
                    const requestableChanged = requestable ? existingAp.requestable !== true : false
                    const accessRequestConfigChanged = accessRequestConfig
                        ? !areJsonEqual(existingAp.accessRequestConfig, accessRequestConfig)
                        : false

                    if (!entitlementsChanged && !requestableChanged && !accessRequestConfigChanged) {
                        logger.debug(`No changes detected for access profile ${apName}, skipping update`)
                        continue
                    }
                }

                try {
                    logger.debug(`Updating existing access profile: ${apName}`)
                    accessProfile = await isc.updateAccessProfile(id, accessProfileUpdate)
                } catch (error) {
                    logger.error(`Error updating access profile: ${getErrorMessage(error)}`)
                    continue
                }
            } else {
                logger.debug(`Creating new access profile: ${apName}`)
                try {
                    accessProfile = await isc.createAccessProfile(
                        apName,
                        ownerId,
                        sourceId,
                        entitlements,
                        requestable,
                        accessRequestConfig
                    )
                    ap.id = accessProfile.id!
                } catch (error) {
                    logger.error(`Error creating access profile: ${getErrorMessage(error)}`)
                    continue
                }
            }
            const app = applicationMap.get(appName)
            if (app) {
                app.accessProfiles.push(ap.id!)
            }
        }

        // Create/update applications
        for (const [appName, app] of applicationMap.entries()) {
            const { appId, sourceId, accessProfiles } = app
            const existingApp = existingAppMap.get(appName)
            if (!appId) {
                logger.debug(`Creating new app: ${appName}`)
                try {
                    const newApp = await isc.createApp(appName, sourceId)
                    app.appId = newApp.id
                } catch (error) {
                    logger.error(`Error creating app: ${getErrorMessage(error)}`)
                    continue
                }
            }

            logger.debug(`Evaluating application ${appName} for update`)
            const updateApplication: JsonPatchOperationV2025[] = [
                {
                    op: 'replace',
                    path: '/accessProfiles',
                    value: accessProfiles,
                },
                {
                    op: 'replace',
                    path: '/enabled',
                    value: true,
                },
                {
                    op: 'replace',
                    path: '/appCenterEnabled',
                    value: true,
                },
                {
                    op: 'replace',
                    path: '/provisionRequestEnabled',
                    value: true,
                },
                {
                    op: 'replace',
                    path: '/matchAllAccounts',
                    value: false,
                },
            ]

            if (existingApp) {
                const accessProfilesChanged = !areStringArraysEqual((existingApp as any).accessProfiles, accessProfiles)
                const enabledChanged = existingApp.enabled !== true
                const appCenterEnabledChanged = existingApp.appCenterEnabled !== true
                const provisionRequestEnabledChanged = existingApp.provisionRequestEnabled !== true
                const matchAllAccountsChanged = existingApp.matchAllAccounts !== false

                if (
                    !accessProfilesChanged &&
                    !enabledChanged &&
                    !appCenterEnabledChanged &&
                    !provisionRequestEnabledChanged &&
                    !matchAllAccountsChanged
                ) {
                    logger.debug(`No changes detected for app ${appName}, skipping update`)
                    continue
                }
            }

            try {
                const updatedApp = await isc.updateSourceAccessProfiles(app.appId!, updateApplication)
            } catch (error) {
                logger.error(`Error updating app: ${getErrorMessage(error)}`)
                continue
            }
        }
    }
}

export const processRoles = async (config: Config, isc: ISCClient) => {
    if (config.roles) {
        logger.debug(`Processing ${config.roles.length} roles`)
        const roleMap = new Map<string, RoleProperties>()
        const entitlementMap = new Map<string, EntitlementV2025[]>()
        const existingRoleMap = new Map<string, RoleV2025>()

        const sources = await isc.listSources()
        const source = sources.find(
            (x) => (x.connectorAttributes as any).spConnectorInstanceId === config.spConnectorInstanceId
        )!

        if (!source) {
            const error = `Unable to find source with spConnectorInstanceId "${config.spConnectorInstanceId}"`
            throw new ConnectorError(error)
        }

        const sourceId = source.id!

        // Process each definition
        roles: for (const definition of config.roles) {
            logger.debug(`Processing definition: ${definition.name}`)

            // ⚡ Bolt: Hoist stringToMembership parsing outside the inner entitlement group loop
            // to prevent redundant AST parsing for the same assignment definition.
            let roleMembership: any = undefined
            if (definition.assignmentDefinition) {
                roleMembership = await stringToMembership(definition.assignmentDefinition, sources)
            }

            const entitlements = await isc.listEntitlements(definition.query)
            logger.debug(`Found ${entitlements.length} entitlements for definition ${definition.name}`)
            // Get entitlements, access profiles, and applications from each entitlement found
            entitlements: for (let entitlement of entitlements) {
                logger.debug(`Processing entitlement: ${entitlement.name} (${entitlement.id})`)
                if (definition.groupByAttribute) {
                    entitlement = normalizeAttributes(entitlement, definition.name)
                    const name = entitlement.attributes![definition.groupAttribute!]
                    if (name) {
                        logger.debug(`Grouping by attribute ${definition.groupAttribute} with value ${name}`)
                        if (!entitlementMap.has(definition.name)) {
                            entitlementMap.set(definition.name, [])
                        }
                        entitlementMap.get(definition.name)?.push(entitlement)
                    } else {
                        logger.error(`Entitlement ${entitlement.id} has no ${definition.groupAttribute} attribute`)
                    }
                } else {
                    logger.debug(`No grouping defined for entitlement ${entitlement.name}`)
                    entitlement = normalizeAttributes(entitlement, definition.name)
                    if (!entitlementMap.has(definition.name)) {
                        entitlementMap.set(definition.name, [])
                    }
                    entitlementMap.get(definition.name)?.push(entitlement)
                }
            }
            groups: for (const groupName of entitlementMap.keys()) {
                logger.debug(`Processing group: ${groupName}`)
                let ownerId: string | undefined

                entitlements: for (const entitlement of entitlementMap.get(groupName)!) {
                    logger.debug(`Processing entitlement in group: ${entitlement.name}`)
                    const entitlementRef = entitlementToRef(entitlement)
                    ownerId = source.owner!.id!

                    const name = buildName(entitlement, definition)
                    logger.debug(`Preparing role: ${name}`)
                    let roleProperties: RoleProperties
                    if (roleMap.has(name)) {
                        roleProperties = roleMap.get(name)!
                        roleProperties.entitlements.push(entitlementRef)
                    } else {
                        roleProperties = {
                            ownerId,
                            entitlements: [entitlementRef],
                            requestable: definition.requestable,
                        }
                        if (definition.approverType) {
                            roleProperties.accessRequestConfig = {
                                approvalSchemes: [
                                    {
                                        approverType: definition.approverType,
                                    },
                                ],
                            }
                        }

                        if (roleMembership) {
                            roleProperties.membership = roleMembership
                        }

                        logger.debug(`Checking for existing role: ${name}`)
                        const existingRole = await isc.getRoleByName(name)
                        if (existingRole) {
                            existingRoleMap.set(name, existingRole)
                            roleProperties.id = existingRole.id
                        }
                        roleMap.set(name, roleProperties)
                    }
                }
            }
        }

        // Create/update roles
        for (const [roleName, role] of roleMap.entries()) {
            const { id, ownerId, entitlements, requestable, accessRequestConfig, membership } = role
            let rolePayload: RoleV2025
            if (id) {
                logger.debug(`Evaluating existing role for update: ${roleName}`)
                const existingRole = existingRoleMap.get(roleName)
                const roleUpdate: JsonPatchOperationV2025[] = [
                    {
                        op: 'replace',
                        path: '/entitlements',
                        value: entitlements,
                    },
                ]
                if (requestable) {
                    roleUpdate.push({
                        op: 'replace',
                        path: '/requestable',
                        value: true,
                    })
                }
                if (accessRequestConfig) {
                    roleUpdate.push({
                        op: 'replace',
                        path: '/accessRequestConfig',
                        value: accessRequestConfig,
                    })
                }
                if (membership) {
                    roleUpdate.push({
                        op: 'replace',
                        path: '/membership',
                        value: membership,
                    })
                }

                if (existingRole) {
                    const entitlementsChanged = !areEntitlementRefsEqual(existingRole.entitlements, entitlements)
                    const requestableChanged = requestable ? existingRole.requestable !== true : false
                    const accessRequestConfigChanged = accessRequestConfig
                        ? !areJsonEqual(existingRole.accessRequestConfig, accessRequestConfig)
                        : false
                    const membershipChanged = membership ? !areJsonEqual(existingRole.membership, membership) : false

                    if (
                        !entitlementsChanged &&
                        !requestableChanged &&
                        !accessRequestConfigChanged &&
                        !membershipChanged
                    ) {
                        logger.debug(`No changes detected for role ${roleName}, skipping update`)
                        continue
                    }
                }
                try {
                    logger.debug(`Updating existing role: ${roleName}`)
                    rolePayload = await isc.updateRole(id, roleUpdate)
                } catch (error) {
                    logger.error(`Error updating role: ${getErrorMessage(error)}`)
                    continue
                }
            } else {
                logger.debug(`Creating new role: ${roleName}`)
                try {
                    rolePayload = await isc.createRole(
                        roleName,
                        ownerId,
                        entitlements,
                        requestable,
                        accessRequestConfig,
                        membership
                    )
                } catch (error) {
                    logger.error(`Error creating role: ${getErrorMessage(error)}`)
                    continue
                }
                role.id = rolePayload.id!
            }
        }
    }
}
