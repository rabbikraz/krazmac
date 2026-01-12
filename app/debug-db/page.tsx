export const dynamic = 'force-dynamic'

export default async function DebugDbPage() {
    try {
        const { getD1Database } = await import('@/lib/db')
        const d1 = await getD1Database()

        return (
            <div className="p-8 font-mono">
                <h1 className="text-xl font-bold mb-4">Database Debug</h1>
                <div className="space-y-2">
                    <p>D1 Available: <span className={d1 ? "text-green-500" : "text-red-500"}>{d1 ? 'YES' : 'NO'}</span></p>
                    <p>Node Env: {process.env.NODE_ENV}</p>
                    <p>Timestamp: {new Date().toISOString()}</p>
                </div>
            </div>
        )
    } catch (e: any) {
        return (
            <div className="p-8 font-mono text-red-500">
                <h1 className="text-xl font-bold mb-4">Debug Failed</h1>
                <pre>{e.message}</pre>
                <pre>{e.stack}</pre>
            </div>
        )
    }
}
