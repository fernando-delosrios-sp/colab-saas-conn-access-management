import { ConnectorError, logger } from '@sailpoint/connector-sdk'
import axios from 'axios'

async function test() {
    try {
        await axios.get('https://httpstat.us/404', { headers: { Authorization: 'Bearer SUPER_SECRET_TOKEN' } })
    } catch (error) {
        throw new ConnectorError(error.message ? error.message : error as string)
    }
}
test().catch(e => console.log(e.message))
