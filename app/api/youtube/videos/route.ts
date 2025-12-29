import { NextResponse } from 'next/server'

const YOUTUBE_CHANNEL_ID = 'UCMrMvXraTLhAtpb0JZQOKhQ'
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

// Mark this route as dynamic
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'your-youtube-api-key-here') {
      return NextResponse.json(
        { error: 'YouTube API key not configured' },
        { status: 500 }
      )
    }

    const requestUrl = request.url ? new URL(request.url) : null
    const searchParams = requestUrl?.searchParams || new URLSearchParams()
    const pageToken = searchParams.get('pageToken') || ''
    const maxResults = parseInt(searchParams.get('maxResults') || '50')

    // Get the channel's uploads playlist ID
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${YOUTUBE_CHANNEL_ID}&key=${YOUTUBE_API_KEY}`
    )

    if (!channelResponse.ok) {
      throw new Error('Failed to fetch channel data')
    }

    const channelData = await channelResponse.json()
    const uploadsPlaylistId = channelData.items[0]?.contentDetails?.relatedPlaylists?.uploads

    if (!uploadsPlaylistId) {
      throw new Error('Could not find uploads playlist')
    }

    // Get videos from the uploads playlist
    let videosUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`
    
    if (pageToken) {
      videosUrl += `&pageToken=${pageToken}`
    }

    const videosResponse = await fetch(videosUrl)

    if (!videosResponse.ok) {
      throw new Error('Failed to fetch videos')
    }

    const videosData = await videosResponse.json()

    // Get detailed video information including duration
    const videoIds = videosData.items.map((item: any) => item.contentDetails.videoId).join(',')
    
    const videoDetailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    )

    if (!videoDetailsResponse.ok) {
      throw new Error('Failed to fetch video details')
    }

    const videoDetailsData = await videoDetailsResponse.json()

    // Filter out shorts (videos under 60 seconds or with #shorts in title)
    const videos = videoDetailsData.items
      .filter((video: any) => {
        const duration = video.contentDetails.duration
        const title = video.snippet.title.toLowerCase()
        
        // Parse duration (format: PT1M30S = 1 minute 30 seconds)
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
        const hours = parseInt(match[1] || '0')
        const minutes = parseInt(match[2] || '0')
        const seconds = parseInt(match[3] || '0')
        const totalSeconds = hours * 3600 + minutes * 60 + seconds
        
        // Exclude shorts: less than 60 seconds OR has #shorts in title
        return totalSeconds >= 60 && !title.includes('#shorts') && !title.includes('shorts')
      })
      .map((video: any) => {
        const duration = video.contentDetails.duration
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
        const hours = parseInt(match[1] || '0')
        const minutes = parseInt(match[2] || '0')
        const seconds = parseInt(match[3] || '0')
        
        let durationStr = ''
        if (hours > 0) {
          durationStr = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        } else {
          durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
        }

        return {
          id: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
          publishedAt: video.snippet.publishedAt,
          duration: durationStr,
          viewCount: parseInt(video.statistics?.viewCount || '0'),
          videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
        }
      })
      .sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    return NextResponse.json({
      videos,
      nextPageToken: videosData.nextPageToken,
      totalResults: videos.length,
    })
  } catch (error: any) {
    console.error('Error fetching YouTube videos:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch videos' },
      { status: 500 }
    )
  }
}

