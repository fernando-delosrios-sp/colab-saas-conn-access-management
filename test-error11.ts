import { ConnectorError, logger } from '@sailpoint/connector-sdk'

function handleError(error: any) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (error && typeof error === 'object' && error.message) {
        errorMessage = String(error.message);
    }
    return errorMessage;
}

try {
    throw new Error('Some error');
} catch (error) {
    logger.error(handleError(error))
}
