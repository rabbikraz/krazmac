export const dynamic = 'force-dynamic'

export default async function DebugDbPage() {
    const steps: string[] = []
    try {
        steps.push('Starting...')
        const { getD1Database, getDb } = await import('@/lib/db')
        const { shiurim } = await import('@/lib/schema')

        steps.push('Imported lib/db')
        const d1 = await getD1Database()

        if (!d1) {
            steps.push('D1 not found')
            throw new Error('D1 not found')
        }
        steps.push('D1 Available')

        const db = await getDb(d1)
        steps.push('Drizzle initialized')

        const result = await db.select().from(shiurim).limit(1).all()
        steps.push(`Query successful. Rows: ${result.length}`)

        return (
            <div className="p-8 font-mono">
                <h1 className="text-xl font-bold mb-4">Database Debug (Advanced)</h1>
                <div className="space-y-2">
                    {steps.map((s, i) => (
                        <div key={i} className="text-green-600">✓ {s}</div>
                    ))}
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-zinc-800 rounded">
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                    </div>
                </div>
            </div>
        )
    } catch (e: any) {
        return (
            <div className="p-8 font-mono text-red-500">
                <h1 className="text-xl font-bold mb-4">Debug Failed</h1>
                <div className="space-y-2 mb-4 text-gray-600 dark:text-gray-400">
                    {steps.map((s, i) => (
                        <div key={i}>✓ {s}</div>
                    ))}
                </div>
                <p className="font-bold">Error:</p>
                <pre>{e.message}</pre>
                <pre>{e.stack}</pre>
            </div>
        )
    }
}
