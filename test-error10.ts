import { ConnectorError, logger } from '@sailpoint/connector-sdk'
import axios from 'axios'

async function test() {
    try {
        await axios.get('https://httpstat.us/404', { headers: { Authorization: 'Bearer SUPER_SECRET_TOKEN' } })
    } catch (error: any) {
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else if (error && typeof error === 'object' && error.message) {
            errorMessage = String(error.message);
        }
        logger.error(`Request failed: ${errorMessage}`)
    }
}
test()
