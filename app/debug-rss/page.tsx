export const dynamic = 'force-dynamic'
import { fetchRSSFeed, syncRSSFeed } from '@/lib/rss-parser'
import { getD1Database } from '@/lib/db'

export default async function DebugRssPage() {
    const steps: string[] = []
    try {
        const feedUrl = 'https://anchor.fm/s/d89491c4/podcast/rss' // Hardcoded for test
        steps.push(`Fetching feed from: ${feedUrl}`)

        // Test 1: Fetch and Parse
        const items = await fetchRSSFeed(feedUrl)
        steps.push(`Fetched ${items.length} items`)

        if (items.length > 0) {
            steps.push(`First item: ${items[0].title} (${items[0].pubDate})`)
        }

        // Test 2: Try Syncing (Dry Run or Real)
        steps.push('Attempting DB Sync...')
        const d1 = await getD1Database()
        if (d1) {
            const result = await syncRSSFeed(d1, feedUrl)
            steps.push(`Sync Result: Synced ${result.synced.length}, Errors ${result.errors.length}`)
        } else {
            steps.push('Skipping DB sync (D1 not found)')
        }

        return (
            <div className="p-8 font-mono">
                <h1 className="text-xl font-bold mb-4">RSS Debug</h1>
                <div className="space-y-2">
                    {steps.map((s, i) => (
                        <div key={i} className="text-green-600">✓ {s}</div>
                    ))}
                </div>
            </div>
        )
    } catch (e: any) {
        return (
            <div className="p-8 font-mono text-red-500">
                <h1 className="text-xl font-bold mb-4">RSS Debug Failed</h1>
                <div className="space-y-2 mb-4 text-gray-600 dark:text-gray-400">
                    {steps.map((s, i) => (
                        <div key={i}>✓ {s}</div>
                    ))}
                </div>
                <pre>{e.message}</pre>
                <pre>{e.stack}</pre>
            </div>
        )
    }
}
