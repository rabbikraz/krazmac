'use client'

import { Button } from '@/components/ui/button'
import { usePlayer } from '@/components/player/PlayerContext'
import { Play } from 'lucide-react'

export function ClientPlayButton({ shiur }: { shiur: any }) {
    const { play } = usePlayer()

    return (
        <Button
            className="w-full gap-2 font-semibold bg-white text-black hover:bg-gray-200"
            onClick={() => play(shiur)}
        >
            <Play className="h-4 w-4" fill="currentColor" />
            Play Episode
        </Button>
    )
}
