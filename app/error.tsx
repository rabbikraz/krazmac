'use client'

import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
            <h2 className="text-xl font-bold mb-4">Something went wrong!</h2>
            <div className="bg-destructive/10 p-4 rounded mb-4 max-w-lg overflow-auto">
                <p className="font-mono text-sm text-destructive">{error.message}</p>
                <p className="font-mono text-xs text-muted-foreground mt-2">Digest: {error.digest}</p>
            </div>
            <button
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                onClick={() => reset()}
            >
                Try again
            </button>
        </div>
    )
}
