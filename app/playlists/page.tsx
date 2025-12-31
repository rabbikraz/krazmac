import Header from '@/components/Header'
import { ExternalLink, Play } from 'lucide-react'
import { YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID } from '@/lib/youtube'
import PlaylistCategory from '@/components/PlaylistCategory'

export const revalidate = 3600 // Revalidate every hour

const PLAYLIST_CATEGORIES = [
  {
    name: 'Bereishis',
    english: 'Genesis',
    keywords: ['bereishis', 'bereshit', 'genesis', 'בראשית', 'noach', 'lech lecha', 'vayeira', 'chayei sarah', 'toldos', 'vayetzei', 'vayishlach', 'vayeshev', 'mikeitz', 'vayigash', 'vayechi']
  },
  {
    name: 'Shemos',
    english: 'Exodus',
    keywords: ['shemos', 'shemot', 'exodus', 'שמות', 'va\'eira', 'vaeira', 'bo', 'beshalach', 'yisro', 'mishpatim', 'teruma', 'tetzave', 'ki sisa', 'vayakhel', 'pekudei']
  },
  {
    name: 'Vayikra',
    english: 'Leviticus',
    keywords: ['vayikra', 'leviticus', 'ויקרא', 'tzav', 'shemini', 'tazria', 'metzorah', 'acharei mos', 'kedoshim', 'emor', 'behar', 'bechukosai']
  },
  {
    name: 'Bamidbar',
    english: 'Numbers',
    keywords: ['bamidbar', 'numbers', 'במדבר', 'naso', 'behaalosecha', 'shelach', 'korach', 'chukas', 'balak', 'pinchas', 'matos', 'massei']
  },
  {
    name: 'Devarim',
    english: 'Deuteronomy',
    keywords: ['devarim', 'deuteronomy', 'דברים', 'va\'eschanan', 'vaeschanan', 'eikev', 're\'eh', 'shoftim', 'ki seitzei', 'ki savo', 'nitzavim', 'vayelech', 'ha\'azinu', 'v\'zos habracha', 'vzos habracha']
  },
  {
    name: 'Jewish Calendar',
    english: 'Holidays',
    keywords: ['calendar', 'holiday', 'moed', 'yom tov', 'rosh hashana', 'yom kippur', 'sukkos', 'sukkot', 'chanukah', 'hanukkah', 'purim', 'pesach', 'passover', 'sefira', 'lag ba\'omer', 'shavuos', 'shavuot', 'tisha b\'av', 'three weeks', 'elul', 'tishrei', 'nissan', 'adar']
  }
]

function getCategoryInfo(title: string): { name: string, orderIndex: number } | null {
  const lowerTitle = title.toLowerCase()
  for (const category of PLAYLIST_CATEGORIES) {
    const keywordIndex = category.keywords.findIndex(keyword => lowerTitle.includes(keyword))
    if (keywordIndex !== -1) {
      return {
        name: category.name,
        orderIndex: keywordIndex
      }
    }
  }
  return null
}

async function getPlaylists() {
  try {
    const playlistsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${YOUTUBE_CHANNEL_ID}&maxResults=50&key=${YOUTUBE_API_KEY}`,
      { next: { revalidate: 3600 } }
    )

    if (!playlistsResponse.ok) {
      console.error('Failed to fetch playlists from YouTube API')
      return []
    }

    const playlistsData = await playlistsResponse.json() as any

    if (!playlistsData.items || playlistsData.items.length === 0) {
      return []
    }

    return playlistsData.items.map((item: any) => {
      const catInfo = getCategoryInfo(item.snippet.title)
      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        videoCount: item.contentDetails?.itemCount || 0,
        publishedAt: item.snippet.publishedAt,
        playlistUrl: `https://www.youtube.com/playlist?list=${item.id}`,
        category: catInfo?.name || null,
        orderIndex: catInfo?.orderIndex ?? 999
      }
    })
  } catch (error) {
    console.error('Error fetching playlists:', error)
    return []
  }
}

export default async function PlaylistsPage() {
  const playlists = await getPlaylists()

  // Group playlists by category
  const groupedPlaylists: Record<string, typeof playlists> = {}
  const ungroupedPlaylists: typeof playlists = []

  playlists.forEach((playlist: any) => {
    if (playlist.category) {
      if (!groupedPlaylists[playlist.category]) {
        groupedPlaylists[playlist.category] = []
      }
      groupedPlaylists[playlist.category].push(playlist)
    } else {
      ungroupedPlaylists.push(playlist)
    }
  })

  // Sort within groups
  Object.keys(groupedPlaylists).forEach(key => {
    groupedPlaylists[key].sort((a: any, b: any) => a.orderIndex - b.orderIndex)
  })

  // Sort categories in order
  const sortedCategories = PLAYLIST_CATEGORIES.filter(cat => groupedPlaylists[cat.name])

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
          <div className="space-y-8">
            {/* Grouped by Category - Collapsible */}
            {sortedCategories.map((category) => {
              const categoryPlaylists = groupedPlaylists[category.name]
              const title = `${category.name} ${category.english !== 'Holidays' ? `(${category.english})` : ''}`
              return (
                <PlaylistCategory
                  key={category.name}
                  title={title}
                  playlists={categoryPlaylists}
                />
              )
            })}

            {/* Ungrouped playlists - Collapsible */}
            {ungroupedPlaylists.length > 0 && (
              <PlaylistCategory
                title="Miscellaneous"
                playlists={ungroupedPlaylists}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
