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
        <div className="fixed bottom-0 left-0 right-0 z-50">
            {/* Gradient Line Top */}
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            <div className="bg-background/80 backdrop-blur-xl border-t border-white/5 supports-[backdrop-filter]:bg-background/60 p-4 shadow-2xl">
                <audio
                    ref={audioRef}
                    src={currentShiur.audioUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => pause()}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                />
                <div className="container max-w-screen-xl mx-auto flex items-center gap-4 md:gap-8">
                    {/* Info */}
                    <div className="flex-1 min-w-0 flex items-center gap-4">
                        {/* Artwork placeholder */}
                        <div className="h-12 w-12 rounded bg-zinc-800 flex items-center justify-center border border-white/10 shrink-0">
                            <span className="font-serif italic text-primary/50">K</span>
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-semibold truncate text-white leading-tight">{currentShiur.title}</h4>
                            <p className="text-xs text-primary truncate font-medium uppercase tracking-wider">{currentShiur.series || "Rabbi Kraz"}</p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col items-center gap-1 flex-[2] max-w-2xl">
                        <div className="flex items-center gap-6">
                            <Button variant="ghost" size="icon" className="hidden sm:inline-flex text-muted-foreground hover:text-white hover:bg-white/5">
                                <SkipBack className="h-5 w-5" />
                            </Button>
                            <Button
                                size="icon"
                                className="h-10 w-10 rounded-full bg-white text-black hover:bg-gray-200 shadow-lg hover:scale-105 transition-transform"
                                onClick={toggle}
                            >
                                {isPlaying ? (
                                    <Pause className="h-5 w-5" fill="currentColor" />
                                ) : (
                                    <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
                                )}
                            </Button>
                            <Button variant="ghost" size="icon" className="hidden sm:inline-flex text-muted-foreground hover:text-white hover:bg-white/5">
                                <SkipForward className="h-5 w-5" />
                            </Button>
                        </div>
                        <div className="w-full flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-10 text-right font-mono">{formatTime(progress)}</span>
                            <Slider
                                value={[progress]}
                                max={duration}
                                step={1}
                                onValueChange={handleSeek}
                                className="w-full cursor-pointer [&>.absolute]:bg-primary"
                            />
                            <span className="text-xs text-muted-foreground w-10 font-mono">{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Volume / Extra */}
                    <div className="flex-1 hidden md:flex justify-end items-center gap-2">
                        <Volume2 className="h-5 w-5 text-muted-foreground" />
                        <Slider defaultValue={[100]} max={100} step={1} className="w-24" />
                    </div>
                </div>
            </div>
        </div>
    )
}
