import { NextResponse } from 'next/server'

const YOUTUBE_CHANNEL_ID = 'UCMrMvXraTLhAtpb0JZQOKhQ'
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

export async function GET() {
  try {
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'your-youtube-api-key-here') {
      return NextResponse.json(
        { error: 'YouTube API key not configured. Please add YOUTUBE_API_KEY to your .env file.' },
        { status: 500 }
      )
    }

    // Get all playlists for the channel
    const playlistsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${YOUTUBE_CHANNEL_ID}&maxResults=50&key=${YOUTUBE_API_KEY}`
    )

    if (!playlistsResponse.ok) {
      const errorData = await playlistsResponse.json().catch(() => ({}))
      console.error('YouTube API error:', errorData)
      throw new Error(`Failed to fetch playlists: ${playlistsResponse.status}`)
    }

    const playlistsData = await playlistsResponse.json()

    if (!playlistsData.items || playlistsData.items.length === 0) {
      return NextResponse.json([])
    }

    const playlists = playlistsData.items.map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      videoCount: item.contentDetails?.itemCount || 0,
      publishedAt: item.snippet.publishedAt,
      playlistUrl: `https://www.youtube.com/playlist?list=${item.id}`,
    }))

    return NextResponse.json(playlists)
  } catch (error: any) {
    console.error('Error fetching YouTube playlists:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch playlists' },
      { status: 500 }
    )
  }
}

