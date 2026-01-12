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
 * Get database client (ASYNC)
 * Safe version that imports drizzle-orm/d1 dynamically to avoid top-level crashes.
 */
export async function getDb(d1Database: D1Database) {
    if (process.env.NODE_ENV !== 'production' && globalForDb.db) {
        return globalForDb.db
    }

    try {
        // Dynamic import needed for Cloudflare Workers to avoid top-level module crash
        const { drizzle } = await import('drizzle-orm/d1');
        const db = drizzle(d1Database, { schema });

        if (process.env.NODE_ENV !== 'production') {
            globalForDb.db = db
        }

        return db;
    } catch (e: any) {
        console.error("Failed to initialize Drizzle:", e);
        throw new Error(`Database initialization failed: ${e.message}`);
    }
}

/**
 * Get D1 database from Cloudflare context
 */
export async function getD1Database(): Promise<D1Database | null> {
    try {
        // Try OpenNext's getCloudflareContext
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const ctx = await getCloudflareContext()
        const env = ctx?.env as any
        if (env?.DB) {
            return env.DB as D1Database
        }
    } catch (e) {
        // Fallback or ignore
    }

    // Fallback to globalThis (dev/preview)
    if ((globalThis as any).DB) {
        return (globalThis as any).DB
    }

    return null
}

export type Database = any
export { schema }
