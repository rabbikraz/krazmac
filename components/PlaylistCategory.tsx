'use client'

import { useState } from 'react'
import { Play, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'

interface PlaylistCategoryProps {
    title: string
    playlists: any[]
}

export default function PlaylistCategory({ title, playlists }: PlaylistCategoryProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="space-y-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between group border-b-2 border-primary/10 hover:border-primary/30 pb-2 transition-colors"
            >
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-primary group-hover:text-secondary transition-colors text-left flex items-center gap-2">
                    {isOpen ? <ChevronDown className="w-6 h-6 md:w-8 md:h-8" /> : <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />}
                    {title}
                </h2>
                <span className="text-sm text-muted-foreground font-medium bg-gray-100 px-3 py-1 rounded-full group-hover:bg-primary/5 transition-colors">
                    {playlists.length} {playlists.length === 1 ? 'Podcast' : 'Podcasts'}
                </span>
            </button>

            <div
                className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 translate-y-0' : 'hidden opacity-0 -translate-y-4'
                    }`}
            >
                {playlists.map((playlist: any) => (
                    <a
                        key={playlist.id}
                        href={`https://www.youtube.com/playlist?list=${playlist.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 overflow-hidden flex flex-col h-full group"
                    >
                        <div className="relative aspect-video bg-gray-200 overflow-hidden">
                            {playlist.thumbnail ? (
                                <img
                                    src={playlist.thumbnail}
                                    alt={playlist.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                    <Play className="w-12 h-12 text-gray-400" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
                                    <Play className="w-6 h-6 text-primary" />
                                </div>
                            </div>
                        </div>
                        <div className="p-5 flex-1 flex flex-col">
                            <h3 className="font-serif text-xl font-semibold text-primary mb-2 line-clamp-2 group-hover:text-secondary transition-colors">
                                {playlist.title}
                            </h3>
                            {playlist.description && (
                                <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-1">
                                    {playlist.description}
                                </p>
                            )}
                            <div className="flex items-center justify-between pt-4 mt-auto border-t border-gray-50">
                                <span className="text-xs text-muted-foreground">
                                    {playlist.videoCount || 0} {playlist.videoCount === 1 ? 'video' : 'videos'}
                                </span>
                                <span className="text-xs text-primary font-medium flex items-center gap-1 group-hover:text-secondary transition-colors">
                                    Watch
                                    <ExternalLink className="w-3 h-3" />
                                </span>
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    )
}
