import SourceManager from '@/components/SourceManager'
import { Suspense } from 'react'

export default function SourceClipperPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading clipper...</div>}>
            <SourceManager />
        </Suspense>
    )
}
