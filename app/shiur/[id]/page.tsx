import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { formatDate, formatDuration, extractYouTubeVideoId, getYouTubeThumbnail } from '@/lib/utils'
import Header from '@/components/Header'
import ShiurAudioPlayer from '@/components/ShiurAudioPlayer'
import PlatformLinks from '@/components/PlatformLinks'
import SourceSheetViewer from '@/components/SourceSheetViewer'

// Mark as dynamic to avoid build-time database access
export const dynamic = 'force-dynamic'
export const revalidate = 60

async function getShiur(id: string) {
  try {
    // Check if DATABASE_URL is available
    if (!process.env.DATABASE_URL) {
      return null
    }
    return await prisma.shiur.findUnique({
      where: { id },
      include: {
        platformLinks: true,
      },
    })
  } catch (error) {
    console.error('Error fetching shiur:', error)
    return null
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const shiur = await getShiur(params.id)
  
  if (!shiur) {
    return {
      title: 'Shiur Not Found',
    }
  }

  // Extract YouTube video ID and get thumbnail
  const youtubeVideoId = extractYouTubeVideoId(shiur.platformLinks?.youtube || shiur.link)
  const thumbnailUrl = getYouTubeThumbnail(youtubeVideoId)

  return {
    title: `${shiur.title} — Rabbi Kraz's Shiurim`,
    description: shiur.blurb || shiur.description?.replace(/<[^>]*>/g, '').substring(0, 160) || 'Source sheet and audio for this powerful shiur by Rabbi Kraz',
    openGraph: {
      title: `${shiur.title} — Rabbi Kraz's Shiurim`,
      description: shiur.blurb || shiur.description?.replace(/<[^>]*>/g, '').substring(0, 160) || 'Source sheet and audio for this powerful shiur by Rabbi Kraz',
      images: thumbnailUrl ? [
        {
          url: thumbnailUrl,
          width: 1200,
          height: 630,
          alt: shiur.title,
        }
      ] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${shiur.title} — Rabbi Kraz's Shiurim`,
      description: shiur.blurb || shiur.description?.replace(/<[^>]*>/g, '').substring(0, 160) || 'Source sheet and audio for this powerful shiur by Rabbi Kraz',
      images: thumbnailUrl ? [thumbnailUrl] : [],
    },
  }
}

export default async function ShiurPage({ params }: { params: { id: string } }) {
  const shiur = await getShiur(params.id)

  if (!shiur) {
    notFound()
  }

  // Format description with line breaks - strip HTML and preserve line structure
  const formatDescription = (desc: string | null | undefined): string[] => {
    if (!desc) return []
    // First, convert common HTML line breaks to newlines
    let text = desc
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
    
    // Strip remaining HTML tags
    text = text.replace(/<[^>]*>/g, '')
    
    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    
    // Split into lines and clean up
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
  }

  const formattedDescription = formatDescription(shiur.description)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 md:py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4 md:mb-8 transition-colors"
        >
          ← Back to Shiurim
        </Link>

        {/* Platform Icons at the Top */}
        {shiur.platformLinks && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-6">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold text-primary mb-6 text-center">
              Listen Now
            </h2>
            <PlatformLinks links={shiur.platformLinks} title={shiur.title} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Title and Blurb - At the Top */}
            <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 md:p-6 lg:p-10">
                <h1 className="font-serif text-2xl md:text-3xl lg:text-5xl font-bold text-primary mb-3 md:mb-4 leading-tight">
                  {shiur.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm text-muted-foreground mb-6 md:mb-8">
                  <span>{formatDate(shiur.pubDate)}</span>
                  {shiur.duration && (
                    <>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <span>{formatDuration(shiur.duration)}</span>
                    </>
                  )}
                </div>

                {shiur.blurb && (
                  <div className="prose prose-sm md:prose-base prose-blue max-w-none mb-4 text-gray-700">
                    <p className="text-base md:text-lg leading-relaxed">{shiur.blurb}</p>
                  </div>
                )}

                {formattedDescription.length > 0 && (
                  <div className="prose prose-sm md:prose-base prose-blue max-w-none text-gray-700">
                    {formattedDescription.map((line, index) => (
                      <p key={index} className="mb-2">{line}</p>
                    ))}
                  </div>
                )}
              </div>
            </article>

            {/* Audio Player */}
            <ShiurAudioPlayer shiur={shiur} />

            {/* Source Sheet - Embedded */}
            {shiur.sourceDoc && (
              <SourceSheetViewer sourceDoc={shiur.sourceDoc} title={shiur.title} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

