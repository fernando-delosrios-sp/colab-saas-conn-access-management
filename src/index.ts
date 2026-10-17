import {
    createConnector,
    readConfig,
    logger,
    StdEntitlementListHandler,
    StdTestConnectionHandler,
    ConnectorError,
} from '@sailpoint/connector-sdk'
import { ISCClient } from './isc-client'
import { Config } from './model/config'
import { aggregateAccessProfiles, aggregateEntitlements, aggregateRoles } from './operations'
import { getErrorMessage } from './utils'
import { EntitlementV2025 } from 'sailpoint-api-client'

export const PROCESSINGWAIT = 60 * 1000
export const connector = async () => {
    const config: Config = await readConfig()
    logger.level = 'debug'
    const isc = new ISCClient(config)

    const stdTestConnection: StdTestConnectionHandler = async (context, input, res) => {
        try {
            await isc.getPublicIdentityConfig()
            res.send({})
        } catch (error) {
            logger.error(getErrorMessage(error))
            throw new ConnectorError(getErrorMessage(error))
        }
    }

    const stdEntitlementList: StdEntitlementListHandler = async (context, input, res) => {
        const interval = setInterval(() => {
            res.keepAlive()
        }, PROCESSINGWAIT)

        try {
            // ⚡ Bolt: Memoize API responses by query string to prevent redundant network calls across distinct configuration blocks
            const fetchEntitlements = (() => {
                const cache = new Map<string, Promise<EntitlementV2025[]>>()
                return (query: string) => {
                    if (!cache.has(query)) {
                        cache.set(query, isc.listEntitlements(query))
                    }
                    return cache.get(query)!
                }
            })()

            switch (input.type) {
                case 'accessProfile':
                    if (config.accessProfiles) {
                        logger.debug(`Processing ${config.accessProfiles.length} access profile definitions`)
                        for (const definition of config.accessProfiles) {
                            await aggregateAccessProfiles(config, isc, definition, fetchEntitlements)
                        }
                    }
                    break
                case 'role':
                    if (config.roles) {
                        logger.debug(`Processing ${config.roles.length} roles`)
                        await aggregateRoles(config, isc, fetchEntitlements)
                    }
                    break
                case 'entitlement':
                    if (config.entitlements) {
                        logger.debug(`Processing ${config.entitlements.length} entitlement definitions`)
                        await aggregateEntitlements(config, isc, fetchEntitlements)
                    }
                    break
                default:
                    logger.debug(`Unknown entitlement type: ${input.type}`)
                    break
            }
        } catch (error) {
            logger.error(getErrorMessage(error))
            throw new ConnectorError(getErrorMessage(error))
        } finally {
            clearInterval(interval)
        }
    }

    return createConnector().stdTestConnection(stdTestConnection).stdEntitlementList(stdEntitlementList)
}
