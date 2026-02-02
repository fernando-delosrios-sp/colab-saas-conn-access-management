/**
 * Search fallback utility for finding access profiles or roles.
 * First tries searching by entitlement IDs, then falls back to searching by names.
 * This pattern is used throughout the codebase to ensure we find entities even when
 * the Search API returns no results.
 */

import { logger } from '@sailpoint/connector-sdk'

export interface SearchFallbackOptions<T> {
    /**
     * Entity IDs (usually entitlement IDs) to search by
     */
    entitlementIds: string[]
    
    /**
     * Names to search by as fallback
     */
    names: string[]
    
    /**
     * Function that searches by entitlement IDs
     */
    searchByEntitlements: (ids: string[]) => Promise<T[]>
    
    /**
     * Function that searches by names (fallback)
     */
    searchByNames: (names: string[]) => Promise<T[]>
    
    /**
     * Entity type name for logging (e.g., "access profiles", "roles")
     */
    entityType: string
}

/**
 * Searches for entities using entitlement IDs first, with automatic fallback to name search.
 * 
 * @returns Array of found entities (from either search method)
 */
export async function searchWithFallback<T>(options: SearchFallbackOptions<T>): Promise<T[]> {
    const { entitlementIds, names, searchByEntitlements, searchByNames, entityType } = options
    
    // Try searching by entitlements first (if we have entitlement IDs)
    if (entitlementIds.length > 0) {
        logger.debug(`Searching ${entityType} by entitlements (${entitlementIds.length} IDs)`)
        const results = await searchByEntitlements(entitlementIds)
        
        if (results.length > 0) {
            logger.debug(`Found ${results.length} ${entityType} via entitlement search`)
            return results
        }
        
        logger.debug(`Entitlement search returned 0 results, falling back to name search`)
    }
    
    // Fallback: search by names
    if (names.length > 0) {
        logger.debug(`Searching ${entityType} by names (${names.length} names)`)
        const results = await searchByNames(names)
        logger.debug(`Found ${results.length} ${entityType} via name search`)
        return results
    }
    
    return []
}
