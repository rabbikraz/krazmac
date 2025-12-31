import Header from '@/components/Header'
import { ExternalLink, Play, Clock, Eye, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import VideoFilters from '@/components/VideoFilters'
import VideosGrid from '@/components/VideosGrid'
import { YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID } from '@/lib/youtube'

export const revalidate = 3600 // Revalidate every hour

async function getVideos() {
  try {
    // Get the channel's uploads playlist ID
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${YOUTUBE_CHANNEL_ID}&key=${YOUTUBE_API_KEY}`,
      { next: { revalidate: 3600 } }
    )

    if (!channelResponse.ok) {
      return []
    }

    const channelData = await channelResponse.json() as any
    const uploadsPlaylistId = channelData.items[0]?.contentDetails?.relatedPlaylists?.uploads

    if (!uploadsPlaylistId) {
      return []
    }

    // Fetch all videos using pagination
    let allVideoIds: string[] = []
    let nextPageToken: string | undefined = undefined

    do {
      let playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}`
      if (nextPageToken) {
        playlistUrl += `&pageToken=${nextPageToken}`
      }

      const videosResponse = await fetch(playlistUrl, { next: { revalidate: 3600 } })

      if (!videosResponse.ok) {
        break
      }

      const videosData = await videosResponse.json() as any
      const pageVideoIds = videosData.items.map((item: any) => item.contentDetails.videoId)
      allVideoIds = allVideoIds.concat(pageVideoIds)
      nextPageToken = videosData.nextPageToken
    } while (nextPageToken)

    // YouTube API limits video details to 50 IDs per request, so batch them
    const allVideos: any[] = []
    for (let i = 0; i < allVideoIds.length; i += 50) {
      const batchIds = allVideoIds.slice(i, i + 50)
      const videoIds = batchIds.join(',')

      // Get detailed video information for this batch
      const videoDetailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`,
        { next: { revalidate: 3600 } }
      )

      if (!videoDetailsResponse.ok) {
        continue
      }

      const videoDetailsData = await videoDetailsResponse.json() as any
      allVideos.push(...videoDetailsData.items)
    }

    // Format all videos and mark them as shiurim or shorts
    const videos = allVideos
      .map((video: any) => {
        const duration = video.contentDetails?.duration || 'PT0S'
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)

        // Handle null match (invalid duration format)
        if (!match) {
          return {
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
            publishedAt: video.snippet.publishedAt,
            duration: '0:00',
            viewCount: parseInt(video.statistics?.viewCount || '0'),
            videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
            type: 'shiur',
          }
        }

        const hours = parseInt(match[1] || '0')
        const minutes = parseInt(match[2] || '0')
        const seconds = parseInt(match[3] || '0')
        const totalSeconds = hours * 3600 + minutes * 60 + seconds

        let durationStr = ''
        if (hours > 0) {
          durationStr = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        } else {
          durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
        }

        // Shorts are videos shorter than 3 minutes (180 seconds)
        const isShort = totalSeconds < 180

        return {
          id: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
          publishedAt: video.snippet.publishedAt,
          duration: durationStr,
          viewCount: parseInt(video.statistics?.viewCount || '0'),
          videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
          type: isShort ? 'short' : 'shiur',
        }
      })
      .sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    return videos
  } catch (error) {
    console.error('Error fetching videos:', error)
    return []
  }
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; shortsPage?: string }>
}) {
  const allVideos = await getVideos()
  const { page: pageParam, shortsPage: shortsPageParam } = await searchParams

  const page = parseInt(pageParam || '1', 10)
  const shortsPage = parseInt(shortsPageParam || '1', 10)

  const shiurim = allVideos.filter(v => v.type === 'shiur')
  const shorts = allVideos.filter(v => v.type === 'short')

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Videos
          </h1>
          <p className="text-muted-foreground">
            Watch shiurim and shorts on YouTube
          </p>
        </div>

        {allVideos.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 text-center">
            <p className="text-gray-600 mb-4">No videos available at the moment.</p>
            <a
              href="https://www.youtube.com/@RabbiKraz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              View videos on YouTube
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Full Videos Section */}
            <details className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <summary className="flex items-center justify-between p-6 cursor-pointer bg-white hover:bg-gray-50 transition-colors list-none select-none">
                <span className="font-serif text-2xl font-semibold text-primary">
                  Full Shiurim ({shiurim.length})
                </span>
                <span className="transform group-open:rotate-180 transition-transform duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </span>
              </summary>
              <div className="p-6 border-t border-gray-100">
                <VideosGrid
                  initialVideos={shiurim}
                  currentPage={page}
                  paramName="page"
                  showFilters={false}
                />
              </div>
            </details>

            {/* Shorts Section */}
            <details className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <summary className="flex items-center justify-between p-6 cursor-pointer bg-white hover:bg-gray-50 transition-colors list-none select-none">
                <span className="font-serif text-2xl font-semibold text-primary">
                  Shorts ({shorts.length})
                </span>
                <span className="transform group-open:rotate-180 transition-transform duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </span>
              </summary>
              <div className="p-6 border-t border-gray-100">
                <VideosGrid
                  initialVideos={shorts}
                  currentPage={shortsPage}
                  paramName="shortsPage"
                  showFilters={false}
                />
              </div>
            </details>
          </div>
        )}
      </main>
    </div>
  )
}
