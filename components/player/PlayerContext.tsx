'use client'

import React, { createContext, useContext, useState, useRef, useEffect } from 'react'

type Shiur = {
    id: string
    title: string
    audioUrl: string
    series?: string
    author?: string
    duration?: number
    image?: string
}

type PlayerContextType = {
    currentShiur: Shiur | null
    isPlaying: boolean
    play: (shiur: Shiur) => void
    pause: () => void
    toggle: () => void
    resume: () => void
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined)

export function PlayerProvider({ children }: { children: React.ReactNode }) {
    const [currentShiur, setCurrentShiur] = useState<Shiur | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)

    const play = (shiur: Shiur) => {
        if (currentShiur?.id === shiur.id) {
            setIsPlaying(true)
        } else {
            setCurrentShiur(shiur)
            setIsPlaying(true)
        }
    }

    const pause = () => setIsPlaying(false)
    const resume = () => setIsPlaying(true)
    const toggle = () => setIsPlaying(!isPlaying)

    return (
        <PlayerContext.Provider value={{ currentShiur, isPlaying, play, pause, toggle, resume }}>
            {children}
        </PlayerContext.Provider>
    )
}

export function usePlayer() {
    const context = useContext(PlayerContext)
    if (context === undefined) {
        throw new Error('usePlayer must be used within a PlayerProvider')
    }
    return context
}
