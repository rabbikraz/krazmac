import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date)
  return format(d, 'MMM d, yyyy')
}

export function formatDuration(seconds: number | string | null | undefined): string {
  if (!seconds) return '0m'

  // Handle "HH:MM:SS" or "MM:SS" string from DB
  if (typeof seconds === 'string') {
    if (seconds.includes(':')) {
      const parts = seconds.split(':').map(Number)
      if (parts.length === 3) {
        return `${parts[0]}h ${parts[1]}m`
      } else if (parts.length === 2) {
        return `${parts[0]}m ${parts[1]}s`
      }
    }
    // Try parsing as simple number string
    const num = parseFloat(seconds)
    if (!isNaN(num)) seconds = num
    else return seconds // Return original string if parse fails (fallback)
  }

  if (typeof seconds === 'number') {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m ${remainingSeconds}s`
  }

  return '0m'
}

export function getShiurUrl(shiur: any): string {
  return `/shiur/${shiur.slug || shiur.id}`
}

export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

export function getYouTubeThumbnail(url: string): string {
  const videoId = extractYouTubeVideoId(url)
  return videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : '/images/placeholder-shiur.jpg'
}

export function safeISOString(date: any): string | null {
  if (!date) return null
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) {
      console.warn('Invalid date encountered:', date)
      return null // Or fallback to new Date().toISOString()
    }
    return d.toISOString()
  } catch (e) {
    console.error('Date parsing error for:', date, e)
    return null
  }
}
