import { ISCClient } from './src/isc-client'
import { Config } from './src/model/config'

// Mock client
jest.mock('./src/isc-client')

const run = async () => {
    // Write a mock test to measure N+1 vs concurrent speed
}
