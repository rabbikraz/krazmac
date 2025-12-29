import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(duration: string | undefined): string {
  if (!duration) return "00:00"
  return duration
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null
  
  // Match various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  
  return null
}

export function getYouTubeThumbnail(videoId: string | null): string | null {
  if (!videoId) return null
  // Use maxresdefault for best quality, fallback to hqdefault
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
}

