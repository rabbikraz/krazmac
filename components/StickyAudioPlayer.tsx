'use client'

import { useState, useRef, useEffect } from 'react'

interface StickyAudioPlayerProps {
    shiur: {
        title: string
        audioUrl: string
        duration?: string | null
    }
}

export default function StickyAudioPlayer({ shiur }: StickyAudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [isMinimized, setIsMinimized] = useState(false)
    const audioRef = useRef<HTMLAudioElement>(null)

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const updateTime = () => setCurrentTime(audio.currentTime)
        const updateDuration = () => setDuration(audio.duration)
        const handleEnded = () => setIsPlaying(false)

        audio.addEventListener('timeupdate', updateTime)
        audio.addEventListener('loadedmetadata', updateDuration)
        audio.addEventListener('ended', handleEnded)

        return () => {
            audio.removeEventListener('timeupdate', updateTime)
            audio.removeEventListener('loadedmetadata', updateDuration)
            audio.removeEventListener('ended', handleEnded)
        }
    }, [])

    const togglePlay = () => {
        const audio = audioRef.current
        if (!audio) return

        if (isPlaying) {
            audio.pause()
        } else {
            audio.play()
        }
        setIsPlaying(!isPlaying)
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current
        if (!audio) return
        audio.currentTime = parseFloat(e.target.value)
        setCurrentTime(audio.currentTime)
    }

    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00'
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    if (isMinimized) {
        return (
            <>
                <audio ref={audioRef} src={shiur.audioUrl} preload="metadata" />
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary text-white">
                    <button
                        onClick={() => setIsMinimized(false)}
                        className="w-full py-1.5 flex items-center justify-center gap-2 text-xs hover:bg-primary/90 transition-colors"
                    >
                        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                        <span className="truncate max-w-[200px]">{shiur.title}</span>
                        <i className="fas fa-chevron-up ml-2"></i>
                    </button>
                    <div className="h-0.5 bg-white/20">
                        <div
                            className="h-full bg-white transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </>
        )
    }

    return (
        <>
            <audio ref={audioRef} src={shiur.audioUrl} preload="metadata" />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-primary text-white shadow-2xl">
                {/* Minimize Button */}
                <button
                    onClick={() => setIsMinimized(true)}
                    className="absolute -top-6 right-4 bg-primary text-white px-2 py-0.5 rounded-t-md text-xs hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                    <i className="fas fa-chevron-down text-[10px]"></i>
                    Hide
                </button>

                {/* Thin layout for PC, slightly larger for mobile */}
                <div className="max-w-5xl mx-auto px-4 py-1.5 md:py-1">
                    <div className="flex items-center gap-3 md:gap-4">
                        {/* Play button - smaller on PC */}
                        <button
                            onClick={togglePlay}
                            className="w-8 h-8 md:w-7 md:h-7 bg-white text-primary rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow flex-shrink-0"
                        >
                            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm md:text-xs ${!isPlaying ? 'ml-0.5' : ''}`}></i>
                        </button>

                        {/* Time */}
                        <span className="text-xs opacity-80 w-10 md:w-8 text-right flex-shrink-0">{formatTime(currentTime)}</span>

                        {/* Progress Bar */}
                        <div className="flex-1">
                            <input
                                type="range"
                                min="0"
                                max={duration || 100}
                                value={currentTime}
                                onChange={handleSeek}
                                className="w-full h-1.5 md:h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                                style={{
                                    background: `linear-gradient(to right, white ${progress}%, rgba(255,255,255,0.2) ${progress}%)`
                                }}
                            />
                        </div>

                        {/* Duration */}
                        <span className="text-xs opacity-80 w-10 md:w-8 flex-shrink-0">{formatTime(duration)}</span>

                        {/* Skip buttons - hidden on very small screens */}
                        <div className="hidden sm:flex items-center gap-1">
                            <button
                                onClick={() => {
                                    if (audioRef.current) {
                                        audioRef.current.currentTime = Math.max(0, currentTime - 15)
                                    }
                                }}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                title="Rewind 15s"
                            >
                                <i className="fas fa-backward text-xs"></i>
                            </button>
                            <button
                                onClick={() => {
                                    if (audioRef.current) {
                                        audioRef.current.currentTime = Math.min(duration, currentTime + 15)
                                    }
                                }}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                title="Forward 15s"
                            >
                                <i className="fas fa-forward text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
