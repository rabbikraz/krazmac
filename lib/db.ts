// import { drizzle } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1' // Try importing TYPE only
import * as schema from './schema'

// Type for Cloudflare Workers environment
export interface Env {
    DB: D1Database
    YOUTUBE_API_KEY?: string
    RSS_FEED_URL?: string
    NEXTAUTH_SECRET?: string
}

// Global drizzle client variable
const globalForDb = globalThis as unknown as {
    db: any | undefined
}

/**
 * Get database client
 * SAFE VERSION: Does not import drizzle-orm/d1 at runtime to prevent crashes.
 * Will throw error if called until we fix the import issue.
 */
export function getDb(d1Database: D1Database) {
    if (process.env.NODE_ENV !== 'production' && globalForDb.db) {
        return globalForDb.db
    }

    // Dynamic import workaround needed for Cloudflare Workers?
    // For now, this is a placeholder to prevent crash.
    console.warn('getDb called - returning dummy or crashing safely')

    // We cannot use drizzle() here without importing it.
    // If we need real DB, we need to fix the import.
    throw new Error("Database connection temporarily disabled for debugging")

    // const db = drizzle(d1Database, { schema })
    // return db
}

/**
 * Get D1 database from Cloudflare context
 */
export async function getD1Database(): Promise<D1Database | null> {
    // Return null to force mock data usage everywhere
    console.warn('getD1Database disabled')
    return null
}

export type Database = any // ReturnType<typeof getDb>

// Export schema for easy access
export { schema }
