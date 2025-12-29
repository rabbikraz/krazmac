'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2 } from 'lucide-react'

interface Shiur {
  id: string
  title: string
  audioUrl: string
  duration?: string | null
}

interface ShiurAudioPlayerProps {
  shiur: Shiur
}

export default function ShiurAudioPlayer({ shiur }: ShiurAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showControls, setShowControls] = useState(true)
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
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(vol)
    if (audioRef.current) {
      audioRef.current.volume = vol
      setIsMuted(vol === 0)
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 0.5
        setIsMuted(false)
      } else {
        audioRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += seconds
    }
  }

  const changePlaybackRate = (rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate
      setPlaybackRate(rate)
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6">
      <audio ref={audioRef} src={shiur.audioUrl} preload="metadata" />
      
      {/* Time Display */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-4">
        <span className="font-medium">{formatTime(currentTime)}</span>
        <span>/</span>
        <span>{formatTime(duration || 0)}</span>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${(currentTime / (duration || 1)) * 100}%, #e5e7eb ${(currentTime / (duration || 1)) * 100}%, #e5e7eb 100%)`
          }}
        />
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-center gap-3 md:gap-6 mb-6">
        <button
          onClick={() => skip(-10)}
          className="p-2.5 hover:bg-gray-100 rounded-full transition-colors touch-manipulation"
          aria-label="Skip back 10 seconds"
        >
          <SkipBack className="w-5 h-5 text-gray-700" />
        </button>
        <button
          onClick={togglePlay}
          className="p-4 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors shadow-lg touch-manipulation"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </button>
        <button
          onClick={() => skip(10)}
          className="p-2.5 hover:bg-gray-100 rounded-full transition-colors touch-manipulation"
          aria-label="Skip forward 10 seconds"
        >
          <SkipForward className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      {/* Secondary Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors touch-manipulation"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-gray-700" />
            ) : (
              <Volume2 className="w-5 h-5 text-gray-700" />
            )}
          </button>
          <div className="hidden md:flex items-center gap-2 w-24">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${(isMuted ? 0 : volume) * 100}%, #e5e7eb ${(isMuted ? 0 : volume) * 100}%, #e5e7eb 100%)`
              }}
            />
          </div>
        </div>

        {/* Playback Speed */}
        <div className="flex items-center gap-2 text-xs md:text-sm">
          <span className="text-gray-600 font-medium hidden sm:inline">Speed:</span>
          {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <button
              key={rate}
              onClick={() => changePlaybackRate(rate)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors touch-manipulation ${
                playbackRate === rate
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

