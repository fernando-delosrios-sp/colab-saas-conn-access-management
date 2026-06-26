import { connector } from './index'
import { createConnector, readConfig, logger, ConnectorError } from '@sailpoint/connector-sdk'
import { ISCClient } from './isc-client'

// Mock dependencies
jest.mock('@sailpoint/connector-sdk', () => {
    return {
        createConnector: jest.fn(),
        readConfig: jest.fn(),
        logger: {
            level: '',
            debug: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
        },
        ConnectorError: class ConnectorError extends Error {
            constructor(message: string) {
                super(message)
                this.name = 'ConnectorError'
            }
        },
    }
})

jest.mock('./isc-client')

describe('connector export', () => {
    let mockStdTestConnection: jest.Mock
    let mockStdEntitlementList: jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()

        // Setup createConnector mock chaining
        mockStdEntitlementList = jest.fn().mockReturnThis()
        mockStdTestConnection = jest.fn().mockReturnValue({
            stdEntitlementList: mockStdEntitlementList,
        })
        ;(createConnector as jest.Mock).mockReturnValue({
            stdTestConnection: mockStdTestConnection,
        })

        // Setup readConfig mock
        ;(readConfig as jest.Mock).mockResolvedValue({
            baseurl: 'https://test.sailpoint.com',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
        })
    })

    it('should initialize connector with required handlers', async () => {
        const result = await connector()

        expect(readConfig).toHaveBeenCalled()
        expect(ISCClient).toHaveBeenCalled()
        expect(createConnector).toHaveBeenCalled()
        expect(mockStdTestConnection).toHaveBeenCalled()
        expect(mockStdEntitlementList).toHaveBeenCalled()
        expect(result).toBeDefined()
    })

    describe('stdTestConnection handler', () => {
        let testConnectionHandler: any

        beforeEach(async () => {
            await connector()
            // Extract the handler passed to stdTestConnection
            testConnectionHandler = mockStdTestConnection.mock.calls[0][0]
        })

        it('should successfully test connection', async () => {
            const mockGetPublicIdentityConfig = jest.fn().mockResolvedValue({})
            ;(ISCClient as jest.Mock).mockImplementation(() => ({
                getPublicIdentityConfig: mockGetPublicIdentityConfig,
            }))

            // Re-initialize to pick up the new mock implementation
            await connector()
            testConnectionHandler = mockStdTestConnection.mock.calls[1][0]

            const mockRes = { send: jest.fn() }

            await testConnectionHandler({}, {}, mockRes)

            expect(mockGetPublicIdentityConfig).toHaveBeenCalled()
            expect(mockRes.send).toHaveBeenCalledWith({})
        })

        it('should handle test connection failure and throw ConnectorError', async () => {
            const mockError = new Error('Test connection failed')
            const mockGetPublicIdentityConfig = jest.fn().mockRejectedValue(mockError)
            ;(ISCClient as jest.Mock).mockImplementation(() => ({
                getPublicIdentityConfig: mockGetPublicIdentityConfig,
            }))

            // Re-initialize to pick up the new mock implementation
            await connector()
            testConnectionHandler = mockStdTestConnection.mock.calls[1][0]

            const mockRes = { send: jest.fn() }

            await expect(testConnectionHandler({}, {}, mockRes)).rejects.toThrow(ConnectorError)
            expect(mockGetPublicIdentityConfig).toHaveBeenCalled()
            expect(logger.error).toHaveBeenCalled()
        })
    })
})
