'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, Play, Clock, Eye, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import VideoFilters from './VideoFilters'

interface VideosGridProps {
  initialVideos: any[]
  currentPage?: number
}

const ITEMS_PER_PAGE = 18

function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

export default function VideosGrid({ initialVideos, currentPage = 1 }: VideosGridProps) {
  const router = useRouter()
  const [filteredVideos, setFilteredVideos] = useState(initialVideos)
  const [page, setPage] = useState(currentPage)
  
  // Update page when currentPage prop changes
  useEffect(() => {
    setPage(currentPage)
  }, [currentPage])
  
  // Reset to page 1 when filter changes
  useEffect(() => {
    if (page > 1 && filteredVideos.length > 0) {
      const totalPages = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE)
      if (page > totalPages) {
        setPage(1)
        router.replace('/videos?page=1')
      }
    }
  }, [filteredVideos, page, router])
  
  const totalPages = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE)
  const startIndex = (page - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedVideos = filteredVideos.slice(startIndex, endIndex)

  return (
    <>
      <VideoFilters videos={initialVideos} onFilterChange={setFilteredVideos} />
      
      {filteredVideos.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 text-center">
          <p className="text-gray-600">No videos match the selected filter.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {paginatedVideos.map((video: any) => (
            <a
              key={video.id}
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 overflow-hidden flex flex-col h-full group"
            >
              <div className="relative aspect-video bg-gray-200 overflow-hidden">
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.title}
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
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {video.duration}
                </div>
                {video.type === 'short' && (
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded font-semibold">
                    SHORTS
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-serif text-xl font-semibold text-primary mb-2 line-clamp-2 group-hover:text-secondary transition-colors">
                  {video.title}
                </h3>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(video.publishedAt)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{formatViewCount(video.viewCount)} views</span>
                  </div>
                </div>
                {video.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-1">
                    {video.description}
                  </p>
                )}
                <div className="flex items-center justify-end pt-4 mt-auto border-t border-gray-50">
                  <span className="text-xs text-primary font-medium flex items-center gap-1 group-hover:text-secondary transition-colors">
                    Watch on YouTube
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </a>
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Link
                href={`/videos?page=${Math.max(1, page - 1)}`}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  page === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                    : 'bg-white text-primary hover:bg-gray-50 border-gray-200'
                }`}
              >
                Previous
              </Link>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  
                  return (
                    <Link
                      key={pageNum}
                      href={`/videos?page=${pageNum}`}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        pageNum === page
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-primary hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      {pageNum}
                    </Link>
                  )
                })}
              </div>
              
              <Link
                href={`/videos?page=${Math.min(totalPages, page + 1)}`}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  page === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                    : 'bg-white text-primary hover:bg-gray-50 border-gray-200'
                }`}
              >
                Next
              </Link>
            </div>
          )}
        </>
      )}
    </>
  )
}

