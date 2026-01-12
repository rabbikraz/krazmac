import Link from 'next/link'
import { formatDate, formatDuration } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Play } from 'lucide-react'
import Header from '@/components/Header'
import { ClientPlayButton } from '@/components/ClientPlayButton'

// Mark as dynamic to avoid build-time database access
export const dynamic = 'force-dynamic'
export const revalidate = 60

// Mock data fallback
const getMockShiurim = () => [
  {
    id: '1',
    title: 'Parshas Vayigash: The Power of Tears',
    series: 'Parsha Hashavua',
    date: new Date(),
    duration: 1800,
    blurb: 'Why did Yosef cry on Binyamin\'s neck? A deep dive into the emotional reunion.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  },
  {
    id: '2',
    title: 'Faith in Times of Uncertainty',
    series: 'Bitachon',
    date: new Date(Date.now() - 86400000),
    duration: 2400,
    blurb: 'Strengthening our emunah when things don\'t go as planned.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
  },
  {
    id: '3',
    title: 'Chanukah: Converting Darkness to Light',
    series: 'Chanukah',
    date: new Date(Date.now() - 86400000 * 3),
    duration: 3200,
    blurb: 'The unique avail of Chanukah is not just removing darkness, but using it.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
  }
]

async function getLatestShiurim() {
  try {
    // Dynamic import to prevent top-level crashes if DB module fails
    const { getDb, getD1Database } = await import('@/lib/db')
    const { shiurim } = await import('@/lib/schema')
    const { desc } = await import('drizzle-orm')

    const d1 = await getD1Database()

    if (!d1) {
      console.warn('D1 database not found, falling back to mock data')
      return getMockShiurim()
    }

    const db = getDb(d1)

    const allShiurim = await db
      .select()
      .from(shiurim)
      .orderBy(desc(shiurim.createdAt))
      .limit(6)
      .all()

    if (allShiurim.length === 0) {
      return getMockShiurim()
    }

    return allShiurim.map(s => ({
      ...s,
      series: 'General',
      date: s.date || s.createdAt
    }))
  } catch (error) {
    console.error('Error fetching shiurim:', error)
    // Fallback to mock data on ANY error
    return getMockShiurim()
  }
}

export default async function Home() {
  const latestShiurim = await getLatestShiurim()

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Abstract Background */}
        <div className="absolute inset-0 bg-background">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background opacity-60"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 grayscale"></div>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 md:pr-12">
            <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-xl">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
              New Release
            </div>
            <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tight leading-[1.1] text-foreground">
              The Art of <br />
              <span className="text-primary italic">Bitachon</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg">
              Discover a deeper connection through our latest series. Rabbi Kraz explores the fundamental principles of trust in the Divine.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button size="lg" className="rounded-full px-8 text-base h-12">
                Start Listening
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8 text-base h-12 border-white/20 hover:bg-white/10">
                Explore Series
              </Button>
            </div>
          </div>

          {/* Hero Visual Card */}
          <div className="hidden md:block relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/50 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
            <Card className="relative h-[500px] w-full bg-card border-none overflow-hidden rounded-2xl shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10"></div>
              {/* Placeholder for Dynamic Art */}
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-zinc-800">
                <Play className="h-32 w-32 opacity-10" />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-8 z-20">
                <p className="text-primary font-medium mb-2">Latest Episode</p>
                <h3 className="text-3xl font-serif font-bold text-white mb-2">
                  {latestShiurim[0]?.title || 'Faith in Uncertainty'}
                </h3>
                <p className="text-gray-300 text-sm mb-6 line-clamp-2">
                  {latestShiurim[0]?.blurb || 'How to maintain composure when the path ahead is unclear.'}
                </p>
                <ClientPlayButton shiur={latestShiurim[0]} />
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Latest Shiurim Grid */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Latest Shiurim</h2>
            <p className="text-muted-foreground">Fresh content uploaded weekly.</p>
          </div>
          <Link href="/archive" className="hidden md:flex items-center text-primary hover:text-primary/80 transition-colors font-medium">
            View All <span className="ml-2">→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {latestShiurim.map((shiur: any) => (
            <Link key={shiur.id} href={`/shiur/${shiur.id}`}>
              <Card className="group bg-card/50 border-white/5 hover:border-primary/50 transition-all duration-300 overflow-hidden rounded-xl hover:shadow-2xl hover:shadow-primary/5">
                <div className="aspect-[4/3] bg-zinc-900 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 z-10 transition-opacity group-hover:opacity-40" />
                  {/* Placeholder Image */}
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-800">
                    <div className="text-8xl font-serif opacity-20">K</div>
                  </div>
                  <div className="absolute bottom-4 right-4 z-20 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                    <div className="rounded-full h-12 w-12 bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                      <Play className="h-5 w-5 ml-1" fill="currentColor" />
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span className="uppercase tracking-wider font-medium text-primary/80">{shiur.series}</span>
                    <span>{formatDuration(shiur.duration || 0)}</span>
                  </div>
                  <h3 className="font-serif text-xl font-bold mb-3 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {shiur.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-4 leading-relaxed">
                    {shiur.blurb || shiur.description}
                  </p>
                  <div className="text-xs text-muted-foreground border-t border-white/5 pt-4">
                    {formatDate(shiur.date || new Date())}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
