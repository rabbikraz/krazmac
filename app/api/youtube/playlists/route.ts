import { NextResponse } from 'next/server'
import { YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID } from '@/lib/youtube'

export async function GET() {
  try {

    // Get all playlists for the channel
    const playlistsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${YOUTUBE_CHANNEL_ID}&maxResults=50&key=${YOUTUBE_API_KEY}`
    )

    if (!playlistsResponse.ok) {
      const errorData = await playlistsResponse.json().catch(() => ({}))
      console.error('YouTube API error:', errorData)
      throw new Error(`Failed to fetch playlists: ${playlistsResponse.status}`)
    }

    const playlistsData = await playlistsResponse.json() as any

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

