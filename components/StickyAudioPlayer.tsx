'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, RotateCcw, RotateCw, ChevronUp, ChevronDown } from 'lucide-react'

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
    const [playbackRate, setPlaybackRate] = useState(1)
    const [showSpeedMenu, setShowSpeedMenu] = useState(false)

    const audioRef = useRef<HTMLAudioElement>(null)
    const isDraggingRef = useRef(false) // Track if user is actively scrubbing

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const updateTime = () => {
            // Only update state from audio if user isn't dragging handle
            if (!isDraggingRef.current) {
                setCurrentTime(audio.currentTime)
            }
        }
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

    const skip = (seconds: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.min(
                Math.max(0, audioRef.current.currentTime + seconds),
                duration || audioRef.current.duration || 999999
            )
        }
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current
        if (!audio) return

        isDraggingRef.current = true // User is dragging
        const newTime = parseFloat(e.target.value)

        setCurrentTime(newTime) // Update UI instantly
        audio.currentTime = newTime // Update audio
    }

    const handleSeekEnd = () => {
        isDraggingRef.current = false
    }

    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00:00'

        const hours = Math.floor(time / 3600)
        const minutes = Math.floor((time % 3600) / 60)
        const seconds = Math.floor(time % 60)

        const h = hours.toString()
        const m = minutes.toString().padStart(2, '0')
        const s = seconds.toString().padStart(2, '0')

        if (hours > 0) {
            return `${h}:${m}:${s}`
        }
        return `0:${m}:${s}`
    }

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    if (isMinimized) {
        return (
            <>
                <audio ref={audioRef} src={shiur.audioUrl} preload="metadata" />
                <button
                    onClick={() => setIsMinimized(false)}
                    className="fixed bottom-4 right-4 z-50 bg-white/95 backdrop-blur text-primary px-3 py-2 rounded-full shadow-lg border border-gray-100 hover:scale-105 transition-transform flex items-center gap-2 font-medium text-xs group"
                >
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        {isPlaying ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" className="ml-0.5" />}
                    </div>
                    <span>Resume</span>
                </button>
            </>
        )
    }

    return (
        <>
            <audio ref={audioRef} src={shiur.audioUrl} preload="metadata" />
            <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
                {/* Floating Island Design on Desktop, Full Width on Mobile */}
                <div className="mx-auto max-w-3xl md:mb-6 pointer-events-auto">
                    {/* Padding Adjust: py-3 mobile, md:px-6 md:py-2 desktop (Compact) */}
                    <div className="bg-white/95 backdrop-blur-md md:rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-t md:border border-gray-200/50 px-4 py-3 md:px-6 md:py-2 safe-area-pb relative">

                        {/* Elegant Hide Button with Text - Option 1: Moved to Left to avoid Speed button crowding */}
                        <div className="absolute top-1 left-4 z-20">
                            <button
                                onClick={() => setIsMinimized(true)}
                                className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-gray-400 hover:text-primary transition-colors uppercase py-1 px-2 rounded-full hover:bg-gray-50/50"
                                title="Collapse Player"
                            >
                                <ChevronDown size={12} strokeWidth={2.5} />
                                <span>Hide</span>
                            </button>
                        </div>

                        <div className="flex flex-col gap-2 pt-3 md:pt-0"> {/* No top padding on desktop inner */}
                            <div className="flex items-center justify-between gap-4 h-full">

                                {/* Controls Group - Perfectly Centered */}
                                <div className="flex items-center gap-4 mx-auto md:mx-0 h-10">
                                    {/* Rewind 30s */}
                                    <button
                                        onClick={() => skip(-30)}
                                        className="text-gray-400 hover:text-primary transition-colors flex flex-col items-center gap-0.5 group p-1.5"
                                        title="Rewind 30s"
                                    >
                                        <RotateCcw size={16} strokeWidth={1.5} />
                                        <span className="text-[9px] font-medium group-hover:text-primary leading-none">30</span>
                                    </button>

                                    {/* Play button - Smaller (w-10) */}
                                    <button
                                        onClick={togglePlay}
                                        className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/20"
                                    >
                                        {isPlaying ? (
                                            <Pause size={18} fill="currentColor" />
                                        ) : (
                                            <Play size={18} fill="currentColor" className="ml-0.5" />
                                        )}
                                    </button>

                                    {/* Forward 30s */}
                                    <button
                                        onClick={() => skip(30)}
                                        className="text-gray-400 hover:text-primary transition-colors flex flex-col items-center gap-0.5 group p-1.5"
                                        title="Forward 30s"
                                    >
                                        <RotateCw size={16} strokeWidth={1.5} />
                                        <span className="text-[9px] font-medium group-hover:text-primary leading-none">30</span>
                                    </button>
                                </div>

                                {/* Desktop: Time & Speed on right */}
                                <div className="hidden md:flex items-center gap-4 flex-1">
                                    <span className="text-xs text-gray-500 font-medium w-16 text-right tabular-nums">{formatTime(currentTime)}</span>

                                    {/* Progress Bar - Primary Color with Thumb */}
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-visible relative group cursor-pointer mx-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max={duration || 100}
                                            value={currentTime}
                                            onChange={handleSeek}
                                            onPointerUp={handleSeekEnd}
                                            onTouchEnd={handleSeekEnd}
                                            className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                                        />
                                        <div className="absolute inset-0 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-100"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        {/* Thumb Dot */}
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-sm pointer-events-none transition-all duration-100 z-10"
                                            style={{ left: `${progress}%` }}
                                        />
                                    </div>

                                    <span className="text-xs text-gray-500 font-medium w-16 tabular-nums">{formatTime(duration)}</span>

                                    {/* Speed */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                            className="text-xs font-bold text-gray-500 hover:text-primary hover:bg-gray-50 px-2 py-1 rounded transition-colors w-10 text-center"
                                        >
                                            {playbackRate}x
                                        </button>
                                        {showSpeedMenu && (
                                            <div className="absolute bottom-full right-0 mb-2 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[3rem] text-center p-1">
                                                {SPEEDS.map((speed) => (
                                                    <button
                                                        key={speed}
                                                        onClick={() => {
                                                            setPlaybackRate(speed)
                                                            setShowSpeedMenu(false)
                                                        }}
                                                        className={`block w-full py-1.5 text-xs font-medium rounded-lg transition-colors ${playbackRate === speed ? 'bg-primary/5 text-primary' : 'hover:bg-gray-50 text-gray-600'
                                                            }`}
                                                    >
                                                        {speed}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Only: Progress Bar & Time */}
                            <div className="md:hidden flex items-center gap-3">
                                <span className="text-[10px] text-gray-400 font-medium w-12 text-right tabular-nums">{formatTime(currentTime)}</span>
                                {/* Timeline Wrapper - Ensure full hit area */}
                                <div className="flex-1 h-2 relative flex items-center mx-1">
                                    {/* Track */}
                                    <div className="absolute inset-x-0 h-1 bg-gray-100 rounded-full"></div>

                                    {/* Fill */}
                                    <div
                                        className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full transition-all duration-100 pointer-events-none"
                                        style={{ width: `${progress}%` }}
                                    />

                                    {/* Thumb Dot - Visible on Mobile too */}
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-sm pointer-events-none transition-all duration-100 z-10"
                                        style={{ left: `${progress}%` }}
                                    />

                                    {/* Input Range Overlay - Full Hit Area */}
                                    <input
                                        type="range"
                                        min="0"
                                        max={duration || 100}
                                        value={currentTime}
                                        onChange={handleSeek}
                                        onPointerUp={handleSeekEnd}
                                        onTouchEnd={handleSeekEnd}
                                        className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                                        style={{ WebkitTapHighlightColor: 'transparent' }}
                                    />
                                </div>
                                <span className="text-[10px] text-gray-400 font-medium w-12 tabular-nums">{formatTime(duration)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
