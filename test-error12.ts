import { ConnectorError, logger } from '@sailpoint/connector-sdk'
import axios from 'axios'

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: unknown }).message);
    }
    return String(error);
}

async function test() {
    try {
        await axios.get('https://httpstat.us/404', { headers: { Authorization: 'Bearer SUPER_SECRET_TOKEN' } })
    } catch (error: any) {
        const message = getErrorMessage(error);
        logger.error(`Error processing access profile: ${message}`);
        logger.error(message);
    }
}
test()
