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

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}

export function getShiurUrl(shiur: any): string {
  return `/shiur/${shiur.slug || shiur.id}`
}

export function extractYouTubeVideoId(url: string): string | null {
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
