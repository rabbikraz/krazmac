import Link from 'next/link'
import { formatDate, formatDuration } from '@/lib/utils'
import { getDb, getD1Database } from '@/lib/db'
import { shiurim, platformLinks } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Play } from 'lucide-react'
import { ClientPlayButton } from '@/components/ClientPlayButton'

// Mark as dynamic to avoid build-time database access
export const dynamic = 'force-dynamic'
export const revalidate = 60

// Mock data callback for dev
const getMockShiurim = () => [
  {
    id: '1',
    title: 'Parshas Vayigash: The Power of Tears',
    series: 'Parsha Hashavua',
    pubDate: new Date(),
    duration: 1800,
    blurb: 'Why did Yosef cry on Binyamin\'s neck? A deep dive into the emotional reunion.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  },
  {
    id: '2',
    title: 'Faith in Times of Uncertainty',
    series: 'Bitachon',
    pubDate: new Date(Date.now() - 86400000),
    duration: 2400,
    blurb: 'Strengthening our emunah when things don\'t go as planned.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
  },
  {
    id: '3',
    title: 'Chanukah: Converting Darkness to Light',
    series: 'Chanukah',
    pubDate: new Date(Date.now() - 86400000 * 3),
    duration: 3200,
    blurb: 'The unique avail of Chanukah is not just removing darkness, but using it.',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
  }
]

async function getLatestShiurim() {
  try {
    const d1 = await getD1Database()

    // In dev environment without D1 locally, fallback to mock
    if (!d1 && process.env.NODE_ENV !== 'production') {
      return getMockShiurim()
    }

    if (!d1) return []

    const db = getDb(d1)

    const allShiurim = await db
      .select()
      .from(shiurim)
      .orderBy(desc(shiurim.createdAt)) // Changed to createdAt as pubDate might be older
      .limit(6)
      .all()

    return allShiurim.map(s => ({
      ...s,
      series: 'General', // TODO: Fetch actua series
      date: s.date || s.createdAt // Handle new schema field
    }))
  } catch (error) {
    console.error('Error fetching shiurim:', error)
    return getMockShiurim()
  }
}

export default async function Home() {
  const latestShiurim = await getLatestShiurim()

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-6 md:py-32 md:px-12 bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10"></div>
        <div className="relative max-w-5xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-serif font-bold tracking-tight">
            Timeless Torah Wisdom
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto">
            Delivered with passion, clarity, and depth. Explore shiurim on Parsha, Bitachon, and more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" variant="secondary" className="font-semibold text-lg px-8">
              Start Listening
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary font-semibold text-lg px-8">
              Browse Series
            </Button>
          </div>
        </div>
      </section>

      {/* Latest Shiurim */}
      <section className="py-16 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 font-serif">Latest Shiurim</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {latestShiurim.map((shiur: any) => (
            <Card key={shiur.id} className="group hover:shadow-lg transition-shadow border-muted">
              <CardHeader className="p-0">
                <div className="h-48 bg-muted w-full relative overflow-hidden rounded-t-lg">
                  {/* Placeholder for image */}
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
                    <span className="font-serif italic text-2xl opacity-20">Rabbi Kraz</span>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-sm text-primary font-medium mb-2">{shiur.series}</div>
                <h3 className="font-serif text-xl font-bold mb-2 line-clamp-2 leading-tight">
                  {shiur.title}
                </h3>
                <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                  {shiur.blurb || shiur.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{formatDate(shiur.pubDate || shiur.date || new Date())}</span>
                  <span>•</span>
                  <span>{formatDuration(shiur.duration || 0)}</span>
                </div>
              </CardContent>
              <CardFooter className="p-6 pt-0">
                <ClientPlayButton shiur={shiur} />
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
