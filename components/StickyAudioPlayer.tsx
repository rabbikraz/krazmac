'use client'

import { useState, useRef, useEffect } from 'react'

interface StickyAudioPlayerProps {
    shiur: {
        title: string
        audioUrl: string
        duration?: string | null
    }
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export default function StickyAudioPlayer({ shiur }: StickyAudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [isMinimized, setIsMinimized] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [playbackRate, setPlaybackRate] = useState(1)
    const [showSpeedMenu, setShowSpeedMenu] = useState(false)
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

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackRate
        }
    }, [playbackRate])

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

    const skip = (seconds: number) => {
        const audio = audioRef.current
        if (!audio) return
        audio.currentTime = Math.max(0, Math.min(duration, currentTime + seconds))
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
                        className="w-full py-2 flex items-center justify-center gap-2 text-sm hover:bg-primary/90 transition-colors"
                    >
                        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                        <span className="truncate max-w-[200px]">{shiur.title}</span>
                        <i className="fas fa-chevron-up ml-2"></i>
                    </button>
                    <div className="h-1 bg-white/20">
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
            <div className={`fixed bottom-0 left-0 right-0 z-50 bg-primary text-white shadow-2xl transition-all duration-300 ease-in-out ${isExpanded ? 'h-48' : 'h-auto'}`}>
                {/* Minimize Button */}
                <button
                    onClick={() => {
                        setIsMinimized(true)
                        setIsExpanded(false)
                    }}
                    className="absolute -top-7 right-4 bg-primary text-white px-3 py-1 rounded-t-lg text-xs hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                    <i className="fas fa-chevron-down"></i>
                    Hide
                </button>

                {/* Expand Button */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="absolute -top-7 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-1 rounded-t-lg text-xs hover:bg-primary/90 transition-colors flex items-center gap-1 shadow-md border-t border-white/10"
                >
                    <i className={`fas fa-chevron-${isExpanded ? 'down' : 'up'}`}></i>
                </button>

                <div className="max-w-5xl mx-auto px-4 py-3 h-full flex flex-col justify-center">
                    <div className="flex flex-col gap-4">

                        {/* Main Controls Row */}
                        <div className="flex items-center gap-3 md:gap-4">
                            {/* Rewind 15s */}
                            <button
                                onClick={() => skip(-15)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block"
                                title="Rewind 15s"
                            >
                                <i className="fas fa-backward text-sm"></i>
                            </button>

                            {/* Rewind 30s (Expanded only or Mobile if space allows?) -> Let's show in expanded view primarily, or adds to row */}
                            {isExpanded && (
                                <button
                                    onClick={() => skip(-30)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/90"
                                    title="Rewind 30s"
                                >
                                    <span className="text-[10px] font-bold">-30</span>
                                </button>
                            )}

                            {/* Play button */}
                            <button
                                onClick={togglePlay}
                                className="w-12 h-12 bg-white text-primary rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow flex-shrink-0 mx-2"
                            >
                                <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-xl ${!isPlaying ? 'ml-1' : ''}`}></i>
                            </button>

                            {/* Forward 30s */}
                            {isExpanded && (
                                <button
                                    onClick={() => skip(30)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/90"
                                    title="Forward 30s"
                                >
                                    <span className="text-[10px] font-bold">+30</span>
                                </button>
                            )}

                            {/* Forward 15s */}
                            <button
                                onClick={() => skip(15)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block"
                                title="Forward 15s"
                            >
                                <i className="fas fa-forward text-sm"></i>
                            </button>

                            {/* Time & Progress - Always Visible */}
                            <div className="flex-1 flex items-center gap-3 ml-2">
                                <span className="text-xs opacity-80 w-10 text-right font-mono">{formatTime(currentTime)}</span>
                                <div className="flex-1 group relative h-4 flex items-center">
                                    <input
                                        type="range"
                                        min="0"
                                        max={duration || 100}
                                        value={currentTime}
                                        onChange={handleSeek}
                                        className="absolute w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white group-hover:h-2 transition-all"
                                        style={{
                                            background: `linear-gradient(to right, white ${progress}%, rgba(255,255,255,0.2) ${progress}%)`
                                        }}
                                    />
                                </div>
                                <span className="text-xs opacity-80 w-10 font-mono">{formatTime(duration)}</span>
                            </div>

                            {/* Speed Control */}
                            {!isExpanded && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                        className="px-2 py-1 text-xs font-medium bg-white/10 hover:bg-white/20 rounded transition-colors"
                                    >
                                        {playbackRate}x
                                    </button>
                                    {showSpeedMenu && (
                                        <div className="absolute bottom-full right-0 mb-2 bg-white text-gray-800 rounded-lg shadow-xl overflow-hidden py-1">
                                            {SPEEDS.map((speed) => (
                                                <button
                                                    key={speed}
                                                    onClick={() => {
                                                        setPlaybackRate(speed)
                                                        setShowSpeedMenu(false)
                                                    }}
                                                    className={`block w-full px-4 py-2 text-sm hover:bg-gray-100 text-left ${playbackRate === speed ? 'bg-primary/10 text-primary font-bold' : ''
                                                        }`}
                                                >
                                                    {speed}x
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Expanded Controls Row */}
                        {isExpanded && (
                            <div className="flex items-center justify-center gap-8 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] uppercase opacity-60 font-medium tracking-wider">Speed</span>
                                    <div className="flex items-center bg-black/20 rounded-full p-1">
                                        {[0.75, 1, 1.25, 1.5, 2].map(speed => (
                                            <button
                                                key={speed}
                                                onClick={() => setPlaybackRate(speed)}
                                                className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${playbackRate === speed
                                                        ? 'bg-white text-primary shadow-sm scale-110'
                                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                {speed}x
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
