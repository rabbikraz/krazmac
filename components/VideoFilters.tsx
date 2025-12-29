'use client'

import { useState } from 'react'

type FilterType = 'all' | 'shiur' | 'short'

interface VideoFiltersProps {
  videos: any[]
  onFilterChange: (filteredVideos: any[]) => void
}

export default function VideoFilters({ videos, onFilterChange }: VideoFiltersProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  const handleFilter = (filter: FilterType) => {
    setActiveFilter(filter)
    
    let filtered = videos
    if (filter === 'shiur') {
      filtered = videos.filter((v) => v.type === 'shiur')
    } else if (filter === 'short') {
      filtered = videos.filter((v) => v.type === 'short')
    }
    
    onFilterChange(filtered)
  }

  const counts = {
    all: videos.length,
    shiur: videos.filter((v) => v.type === 'shiur').length,
    short: videos.filter((v) => v.type === 'short').length,
  }

  return (
    <div className="flex flex-wrap gap-3 mb-8">
      <button
        onClick={() => handleFilter('all')}
        className={`px-6 py-2 rounded-full font-medium transition-colors ${
          activeFilter === 'all'
            ? 'bg-primary text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
        }`}
      >
        All ({counts.all})
      </button>
      <button
        onClick={() => handleFilter('shiur')}
        className={`px-6 py-2 rounded-full font-medium transition-colors ${
          activeFilter === 'shiur'
            ? 'bg-primary text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
        }`}
      >
        Shiurim ({counts.shiur})
      </button>
      <button
        onClick={() => handleFilter('short')}
        className={`px-6 py-2 rounded-full font-medium transition-colors ${
          activeFilter === 'short'
            ? 'bg-primary text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
        }`}
      >
        Shorts ({counts.short})
      </button>
    </div>
  )
}

