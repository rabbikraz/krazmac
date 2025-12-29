import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate, formatDuration } from '@/lib/utils'
import Header from '@/components/Header'
import PlayButton from '@/components/PlayButton'
import PlatformGrid from '@/components/PlatformGrid'
import { Calendar, Clock, Info } from 'lucide-react'

// Mark as dynamic to avoid build-time database access
export const dynamic = 'force-dynamic'
export const revalidate = 60 // Revalidate every 60 seconds

async function getLatestShiurim() {
  try {
    // Check if DATABASE_URL is available
    if (!process.env.DATABASE_URL) {
      return []
    }
    return await prisma.shiur.findMany({
      take: 9,
      orderBy: { pubDate: 'desc' },
      include: {
        platformLinks: true,
      },
    })
  } catch (error) {
    console.error('Error fetching shiurim:', error)
    return []
  }
}

export default async function Home() {
  const shiurim = await getLatestShiurim()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12">
        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl font-semibold text-primary mb-2">
              Listen Anywhere
            </h2>
            <p className="text-muted-foreground">Subscribe on your favorite platform</p>
          </div>
          <PlatformGrid />
        </section>

        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-serif text-3xl font-semibold text-primary">
              Latest Shiurim
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shiurim.map((shiur) => (
              <div
                key={shiur.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 overflow-hidden flex flex-col h-full group"
              >
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-serif text-xl font-semibold text-primary line-clamp-2 group-hover:text-secondary transition-colors">
                      <Link href={`/shiur/${shiur.id}`}>{shiur.title}</Link>
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(shiur.pubDate)}</span>
                    </div>
                    {shiur.duration && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDuration(shiur.duration)}</span>
                      </div>
                    )}
                  </div>
                  {shiur.blurb && (
                    <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1">
                      {shiur.blurb}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-4 mt-auto border-t border-gray-50">
                    <PlayButton shiur={shiur} />
                    <Link
                      className="flex items-center gap-1 text-sm text-secondary hover:text-primary font-medium"
                      href={`/shiur/${shiur.id}`}
                    >
                      Details <Info className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-2xl mx-auto text-center bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <h2 className="font-serif text-2xl font-semibold text-primary mb-4">
            Join the WhatsApp Group
          </h2>
          <p className="text-gray-600 mb-6">
            Get the latest shiur updates, announcements, and live shiur links directly to your phone.
          </p>
          <a
            href="https://chat.whatsapp.com/BdUZM8mzvXuEpgS9MoGN9W"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#25D366] text-white rounded-full font-bold hover:bg-[#128C7E] transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-[#25D366] font-bold text-xs">
              WA
            </div>
            Join Group
          </a>
        </section>
      </main>
      <footer className="bg-primary text-white py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="opacity-80 mb-4">
            © {new Date().getFullYear()} Rabbi Kraz's Shiurim. All rights reserved.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-sm text-blue-200">
            <div className="flex gap-6">
              <Link className="hover:text-white transition-colors" href="/">
                Home
              </Link>
              <Link className="hover:text-white transition-colors" href="/playlists">
                Playlists
              </Link>
              <Link className="hover:text-white transition-colors" href="/sponsor">
                Sponsor
              </Link>
              <a className="hover:text-white transition-colors" href="mailto:rabbikraz1@gmail.com">
                Contact
              </a>
            </div>
            <a
              href="https://anchor.fm/s/d89491c4/podcast/rss"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M4 11a9 9 0 0 1 9 9"></path>
                <path d="M4 4a16 16 0 0 1 16 16"></path>
                <circle cx="5" cy="19" r="1"></circle>
              </svg>
              RSS Feed
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

