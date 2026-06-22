import { ConnectorError, logger } from '@sailpoint/connector-sdk'
import axios from 'axios'

async function test() {
    try {
        await axios.get('https://httpstat.us/404', { headers: { Authorization: 'Bearer SUPER_SECRET_TOKEN' } })
    } catch (error: any) {
        logger.error(error.message || String(error))
        throw new ConnectorError(error.message || String(error))
    }
}
test().catch(e => console.log("Caught:", e.message))
