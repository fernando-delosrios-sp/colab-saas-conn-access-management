import { logger, ConnectorError } from '@sailpoint/connector-sdk'
import { EntitlementV2025, RequestabilityForRoleV2025, RoleV2025 } from 'sailpoint-api-client'
import { ISCClient, LightweightRole } from '../isc-client'
import { Config } from '../model/config'
import { RoleProperties } from '../model/propertyDefinitions'
import {
    buildApprovalSchemesConfig,
    buildEntitlementPatch,
    buildName,
    detectRequestableAndConfigChanges,
    entitlementToRef,
    evaluateVelocityTemplate as evaluateVelocityExpression,
    pushToGroupMap,
    runWithConcurrency,
    shouldSkipUpdate,
} from '../utils'

const API_CONCURRENCY = 8
import { stringToMembership } from '../utils/membership-parser'

/**
 * Aggregates roles from entitlements in ISC (Identity Security Cloud).
 *
 * Flow:
 * 1. Resolve source by spConnectorInstanceId.
 * 2. For each definition: fetch entitlements via query, group by entitlementExpression result.
 * 3. For each group: build RoleProperties (entitlements, requestable, approval, membership).
 * 4. Create or update roles in ISC.
 * 5. Optionally delete stale roles (when deleteStaleRoles is enabled).
 */
export async function aggregateRoles(config: Config, isc: ISCClient): Promise<void> {
    const roleMap = new Map<string, RoleProperties>()
    const entitlementMap = new Map<string, EntitlementV2025[]>()
    const existingRoleMap = new Map<string, LightweightRole>()
    const allEntitlementIds = new Set<string>()
    let existingRolesFetched = false

    // Find the connector's source (needed for ownerId)
    const sources = await isc.listSources()
    const source = sources.find(
        (x) => (x.connectorAttributes as any).spConnectorInstanceId === config.spConnectorInstanceId
    )!

    if (!source) {
        const error = `Unable to find source with spConnectorInstanceId "${config.spConnectorInstanceId}"`
        throw new ConnectorError(error)
    }

    const deleteStaleRoles = config.roles!.some(
        (d) => d.deleteStaleRoles === true || String(d.deleteStaleRoles) === 'true'
    )

    // ─── Phase 1: Collect entitlements and group them per definition ───
    roles: for (const definition of config.roles!) {
        logger.debug(`Processing definition: ${definition.name}`)
        entitlementMap.clear()
        const entitlements = await isc.listEntitlements(definition.query)
        logger.debug(`Found ${entitlements.length} entitlements for definition ${definition.name}`)

        // Collect entitlement IDs (for a single search later)
        for (const ent of entitlements) {
            if (ent.id) allEntitlementIds.add(ent.id)
        }

        // Evaluate entitlementExpression; group by role name (definition name or attribute value)
        entitlements: for (const entitlement of entitlements) {
            logger.debug(`Processing entitlement: ${entitlement.name} (${entitlement.id})`)
            const context = { entitlement } as Record<string, unknown>
            let roleName = definition.name
            const name = evaluateVelocityExpression(definition.entitlementExpression, context)
            // Skip if expression evaluated to empty
            if (!name) {
                logger.info(
                    `Skipping entitlement ${entitlement.id}: expression evaluated to empty`
                )
                continue entitlements
            }

            if (definition.groupEntitlements) {
                // Each unique expression result becomes a separate role
                logger.debug(`Grouping by attribute ${definition.entitlementExpression} with value ${name}`)
                roleName = name
            }
            pushToGroupMap(entitlementMap, roleName, entitlement)
        }

        // ─── Phase 2: For each group in this definition, build role properties ───
        // In delete mode, skip expensive operations (lookups, property building)
        if (!deleteStaleRoles) {
            // Fetch existing roles once (globally across all definitions) using Search API
            // Returns only essential fields to minimize memory usage
            if (!existingRolesFetched && allEntitlementIds.size > 0) {
                logger.debug(`Pre-fetching existing roles via Search API (${allEntitlementIds.size} entitlement IDs)`)
                const searchResults = await isc.searchRolesByEntitlements(Array.from(allEntitlementIds))
                for (const roleDoc of searchResults) {
                    existingRoleMap.set(roleDoc.name, roleDoc)
                }
                existingRolesFetched = true
            }

            groups: for (const groupName of entitlementMap.keys()) {
                logger.debug(`Processing group: ${groupName}`)
                const ownerId = source.owner!.id!

                for (const entitlement of entitlementMap.get(groupName)!) {
                    logger.debug(`Processing entitlement in group: ${entitlement.name}`)
                    const entitlementRef = entitlementToRef(entitlement)

                    logger.debug(`Preparing role: ${groupName}`)
                    let roleProperties: RoleProperties
                    if (roleMap.has(groupName)) {
                        roleProperties = roleMap.get(groupName)!
                        roleProperties.entitlements.push(entitlementRef)
                    } else {
                        const existingRole = existingRoleMap.get(groupName)
                        roleProperties = {
                            ownerId,
                            entitlements: [entitlementRef],
                            requestable: definition.requestable,
                        }
                        if (definition.approverType) {
                            roleProperties.accessRequestConfig = buildApprovalSchemesConfig(
                                definition.approverType
                            ) as RequestabilityForRoleV2025
                        }

                        if (definition.assignmentDefinition) {
                            const assignmentDefinition = buildName(entitlement, definition.assignmentDefinition)
                            const membership = await stringToMembership(assignmentDefinition, sources)
                            roleProperties.membership = membership
                        }

                        if (existingRole) {
                            roleProperties.id = existingRole.id
                        }
                        roleMap.set(groupName, roleProperties)
                    }
                }
            }
        }
    }

    // ─── Phase 3: Create or update roles in ISC (with concurrency) ───
    // Skip when delete option is enabled: no creations or updates, only deletions
    if (!deleteStaleRoles) {
    await runWithConcurrency(Array.from(roleMap.entries()), API_CONCURRENCY, async ([roleName, role]) => {
        const { id, ownerId, entitlements, requestable, accessRequestConfig, membership } = role

        if (id) {
            const existingRole = existingRoleMap.get(roleName)
            if (!existingRole) {
                logger.warn(`Role ${roleName} has id but no cached existing role, skipping update`)
                return
            }
            logger.debug(`Evaluating existing role for update: ${roleName}`)
            const changes = detectRequestableAndConfigChanges(
                existingRole,
                entitlements,
                requestable,
                accessRequestConfig,
                membership
            )
            if (shouldSkipUpdate(changes, true)) {
                logger.debug(`No changes detected for role ${roleName}, skipping update`)
                return
            }
            const roleUpdate = buildEntitlementPatch(entitlements, {
                requestable,
                accessRequestConfig,
                membership,
            })
            try {
                logger.debug(`Updating existing role: ${roleName}`)
                const rolePayload = await isc.updateRole(id, roleUpdate)
                role.id = rolePayload.id!
            } catch (error) {
                logger.error(`Error updating role: ${error}`)
            }
        } else {
            logger.debug(`Creating new role: ${roleName}`)
            try {
                const rolePayload = await isc.createRole(
                    roleName,
                    ownerId,
                    entitlements,
                    requestable,
                    accessRequestConfig,
                    membership
                )
                role.id = rolePayload.id!
            } catch (error) {
                logger.error(`Error creating role: ${error}`)
            }
        }
    })
    }

    // ─── Phase 4: Delete stale roles (when toggle enabled) with concurrency ───
    if (!deleteStaleRoles) return

    if (allEntitlementIds.size === 0) {
        logger.debug('No entitlements found for delete run, skipping')
        return
    }

    // Use pre-fetched existing roles (already searched in Phase 1/2)
    // If not fetched yet (delete-only mode), fetch now
    if (existingRoleMap.size === 0 && allEntitlementIds.size > 0) {
        logger.debug(`Fetching existing roles for delete via Search API (${allEntitlementIds.size} entitlement IDs)`)
        const searchResults = await isc.searchRolesByEntitlements(Array.from(allEntitlementIds))
        for (const roleDoc of searchResults) {
            existingRoleMap.set(roleDoc.name, roleDoc)
        }
    }

    const currentRoleNames = new Set(roleMap.keys())
    
    // Filter to only roles whose names match those produced by our definitions
    const rolesToDelete = Array.from(existingRoleMap.values()).filter(
        (role) => role.id && role.name && currentRoleNames.has(role.name)
    )
    
    logger.debug(`Delete run: found ${existingRoleMap.size} existing roles, ${rolesToDelete.length} previously created to delete`)
    await runWithConcurrency(rolesToDelete, API_CONCURRENCY, async (role) => {
        try {
            logger.info(`Deleting previously created role: ${role.name}`)
            await isc.deleteRole(role.id!)
        } catch (error) {
            logger.error(`Error deleting role ${role.name}: ${error}`)
        }
    })
}
