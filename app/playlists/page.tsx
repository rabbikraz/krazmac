import Header from '@/components/Header'
import { ExternalLink, Play } from 'lucide-react'

export const revalidate = 3600 // Revalidate every hour

const TORAH_BOOKS = [
  { name: 'Bereishit', english: 'Genesis', keywords: ['bereishit', 'bereshit', 'genesis', 'בראשית'] },
  { name: 'Shemot', english: 'Exodus', keywords: ['shemot', 'exodus', 'שמות'] },
  { name: 'Vayikra', english: 'Leviticus', keywords: ['vayikra', 'leviticus', 'ויקרא'] },
  { name: 'Bamidbar', english: 'Numbers', keywords: ['bamidbar', 'numbers', 'במדבר'] },
  { name: 'Devarim', english: 'Deuteronomy', keywords: ['devarim', 'deuteronomy', 'דברים'] },
]

function getBookOfTorah(title: string): string | null {
  const lowerTitle = title.toLowerCase()
  for (const book of TORAH_BOOKS) {
    if (book.keywords.some(keyword => lowerTitle.includes(keyword))) {
      return book.name
    }
  }
  return null
}

async function getPlaylists() {
  try {
    const YOUTUBE_CHANNEL_ID = 'UCMrMvXraTLhAtpb0JZQOKhQ'
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'your-youtube-api-key-here') {
      return []
    }

    const playlistsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${YOUTUBE_CHANNEL_ID}&maxResults=50&key=${YOUTUBE_API_KEY}`,
      { next: { revalidate: 3600 } }
    )

    if (!playlistsResponse.ok) {
      console.error('Failed to fetch playlists from YouTube API')
      return []
    }

    const playlistsData = await playlistsResponse.json()

    if (!playlistsData.items || playlistsData.items.length === 0) {
      return []
    }

    return playlistsData.items.map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      videoCount: item.contentDetails?.itemCount || 0,
      publishedAt: item.snippet.publishedAt,
      playlistUrl: `https://www.youtube.com/playlist?list=${item.id}`,
      book: getBookOfTorah(item.snippet.title),
    }))
  } catch (error) {
    console.error('Error fetching playlists:', error)
    return []
  }
}

export default async function PlaylistsPage() {
  const playlists = await getPlaylists()

  // Group playlists by book of Torah
  const groupedPlaylists: Record<string, typeof playlists> = {}
  const ungroupedPlaylists: typeof playlists = []

  playlists.forEach((playlist: any) => {
    if (playlist.book) {
      if (!groupedPlaylists[playlist.book]) {
        groupedPlaylists[playlist.book] = []
      }
      groupedPlaylists[playlist.book].push(playlist)
    } else {
      ungroupedPlaylists.push(playlist)
    }
  })

  // Sort books in order
  const sortedBooks = TORAH_BOOKS.filter(book => groupedPlaylists[book.name])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Playlists
          </h1>
          <p className="text-muted-foreground">
            Browse curated collections of shiurim on YouTube
          </p>
        </div>

        {playlists.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 text-center">
            <p className="text-gray-600 mb-4">No playlists available at the moment.</p>
            <a
              href="https://www.youtube.com/@RabbiKraz/playlists"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              View playlists on YouTube
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Grouped by Book of Torah */}
            {sortedBooks.map((book) => {
              const bookPlaylists = groupedPlaylists[book.name]
              return (
                <div key={book.name} className="space-y-6">
                  <h2 className="font-serif text-2xl md:text-3xl font-bold text-primary border-b-2 border-primary pb-2">
                    {book.name} ({book.english})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bookPlaylists.map((playlist: any) => (
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
            })}

            {/* Ungrouped playlists */}
            {ungroupedPlaylists.length > 0 && (
              <div className="space-y-6">
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-primary border-b-2 border-primary pb-2">
                  Other Playlists
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ungroupedPlaylists.map((playlist: any) => (
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
            )}
          </div>
        )}
      </main>
    </div>
  )
}
