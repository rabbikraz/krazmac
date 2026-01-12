'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function RefreshRssButton() {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleRefresh = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/rss/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    feedUrl: 'https://anchor.fm/s/d89491c4/podcast/rss' // Hardcoded for reliability
                }),
            })

            if (!res.ok) {
                const errData = await res.json().catch(() => ({})) as any
                throw new Error(errData.error || `Server error: ${res.status}`)
            }

            const data = await res.json() as { synced: number, errors: any[] }
            alert(`Synced ${data.synced} new episodes.`)
            router.refresh()
        } catch (error) {
            console.error(error)
            alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-2"
        >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing...' : 'Refresh RSS'}
        </Button>
    )
}
