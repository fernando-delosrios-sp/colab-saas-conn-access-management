/**
 * Search fallback utility for finding access profiles or roles.
 * First tries searching by entitlement IDs, then falls back to searching by names.
 */

import { logger } from '@sailpoint/connector-sdk'

export interface SearchFallbackOptions<T> {
    entitlementIds: string[]
    names: string[]
    searchByEntitlements: (ids: string[]) => Promise<T[]>
    searchByNames: (names: string[]) => Promise<T[]>
    entityType: string
}

/**
 * Searches for entities using entitlement IDs first, with automatic fallback to name search.
 */
export async function searchWithFallback<T>(options: SearchFallbackOptions<T>): Promise<T[]> {
    const { entitlementIds, names, searchByEntitlements, searchByNames, entityType } = options
    
    if (entitlementIds.length > 0) {
        logger.debug(`Searching ${entityType} by entitlements (${entitlementIds.length} IDs)`)
        const results = await searchByEntitlements(entitlementIds)
        
        if (results.length > 0) {
            logger.debug(`Found ${results.length} ${entityType} via entitlement search`)
            return results
        }
        
        logger.debug(`Entitlement search returned 0 results, falling back to name search`)
    }
    
    if (names.length > 0) {
        logger.debug(`Searching ${entityType} by names (${names.length} names)`)
        const results = await searchByNames(names)
        logger.debug(`Found ${results.length} ${entityType} via name search`)
        return results
    }
    
    return []
}
