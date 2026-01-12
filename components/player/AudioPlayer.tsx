'use client'

import { usePlayer } from './PlayerContext'
import { Play, Pause, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export function AudioPlayer() {
    const { currentShiur, isPlaying, pause, resume, toggle } = usePlayer()
    const audioRef = useRef<HTMLAudioElement>(null)
    const [progress, setProgress] = useState(0)
    const [duration, setDuration] = useState(0)

    useEffect(() => {
        if (currentShiur && audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch(() => pause())
            } else {
                audioRef.current.pause()
            }
        }
    }, [currentShiur, isPlaying, pause])

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setProgress(audioRef.current.currentTime)
            setDuration(audioRef.current.duration || 0)
        }
    }

    const handleSeek = (value: number[]) => {
        if (audioRef.current) {
            audioRef.current.currentTime = value[0]
            setProgress(value[0])
        }
    }

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    if (!currentShiur) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 shadow-lg z-50">
            <audio
                ref={audioRef}
                src={currentShiur.audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => pause()}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            />
            <div className="container max-w-screen-xl mx-auto flex items-center gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{currentShiur.title}</h4>
                    <p className="text-sm text-muted-foreground truncate">{currentShiur.series}</p>
                </div>

                {/* Controls */}
                <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
                            <SkipBack className="h-5 w-5" />
                        </Button>
                        <Button
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            onClick={toggle}
                        >
                            {isPlaying ? (
                                <Pause className="h-5 w-5" />
                            ) : (
                                <Play className="h-5 w-5 ml-0.5" />
                            )}
                        </Button>
                        <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
                            <SkipForward className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="w-full max-w-md flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(progress)}</span>
                        <Slider
                            value={[progress]}
                            max={duration}
                            step={1}
                            onValueChange={handleSeek}
                            className="w-full cursor-pointer"
                        />
                        <span className="text-xs text-muted-foreground w-10">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Volume / Extra */}
                <div className="flex-1 flex justify-end items-center gap-2">
                    <Volume2 className="h-5 w-5 text-muted-foreground" />
                    <Slider defaultValue={[100]} max={100} step={1} className="w-24 hidden sm:flex" />
                </div>
            </div>
        </div>
    )
}
