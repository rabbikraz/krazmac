'use client'

import { useState, useRef } from 'react'
import { Play } from 'lucide-react'

interface Shiur {
  id: string
  title: string
  audioUrl: string
}

interface PlayButtonProps {
  shiur: Shiur
}

export default function PlayButton({ shiur }: PlayButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const togglePlay = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={shiur.audioUrl}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
      <button
        onClick={togglePlay}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
      >
        <Play className="w-4 h-4" />
        {isPlaying ? 'Playing' : 'Listen'}
      </button>
    </>
  )
}

