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
import { processAccessProfiles, processRoles } from './processors'

export const PROCESSINGWAIT = 60 * 1000

// Connector must be exported as module property named connector
export const connector = async () => {
    // Get connector source config
    const config: Config = await readConfig()
    logger.level = 'debug'

    // Use the vendor SDK, or implement own client as necessary, to initialize a client
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
            // Access profiles
            await processAccessProfiles(config, isc)
            await processRoles(config, isc)
        } catch (error) {
            logger.error(getErrorMessage(error))
            throw new ConnectorError(getErrorMessage(error))
        } finally {
            clearInterval(interval)
        }
    }

    return createConnector().stdTestConnection(stdTestConnection).stdEntitlementList(stdEntitlementList)
}
