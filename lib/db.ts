import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

// Type for Cloudflare Workers environment
export interface Env {
    DB: D1Database
    YOUTUBE_API_KEY?: string
    RSS_FEED_URL?: string
    NEXTAUTH_SECRET?: string
}

// Global drizzle client  variable (for development with global singleton)
const globalForDb = globalThis as unknown as {
    db: ReturnType<typeof drizzle> | undefined
}

/**
 * Get database client
 * In Workers runtime, this will use the D1 binding from env
 * In development, it will use a global singleton
 */
export function getDb(d1Database: D1Database) {
    if (process.env.NODE_ENV !== 'production' && globalForDb.db) {
        return globalForDb.db
    }

    const db = drizzle(d1Database, { schema })

    if (process.env.NODE_ENV !== 'production') {
        globalForDb.db = db
    }

    return db
}

export type Database = ReturnType<typeof getDb>

// Export schema for easy access
export { schema }
