import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate, formatDuration } from '@/lib/utils'
import Header from '@/components/Header'
import PlayButton from '@/components/PlayButton'
import { Calendar, Clock, Info } from 'lucide-react'

// Mark as dynamic to avoid build-time database access
export const dynamic = 'force-dynamic'
export const revalidate = 60

const ITEMS_PER_PAGE = 18

async function getAllShiurim(page: number = 1) {
  try {
    // Check if DATABASE_URL is available
    if (!process.env.DATABASE_URL) {
      return { shiurim: [], total: 0, totalPages: 0 }
    }
    
    const skip = (page - 1) * ITEMS_PER_PAGE
    
    const [shiurim, total] = await Promise.all([
      prisma.shiur.findMany({
        skip,
        take: ITEMS_PER_PAGE,
        orderBy: { pubDate: 'desc' },
        include: {
          platformLinks: true,
        },
      }),
      prisma.shiur.count(),
    ])
    
    return {
      shiurim,
      total,
      totalPages: Math.ceil(total / ITEMS_PER_PAGE),
    }
  } catch (error) {
    console.error('Error fetching shiurim:', error)
    return { shiurim: [], total: 0, totalPages: 0 }
  }
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const page = parseInt(searchParams.page || '1', 10)
  const { shiurim, total, totalPages } = await getAllShiurim(page)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-semibold text-primary mb-2">
            All Shiurim
          </h1>
          <p className="text-muted-foreground">
            Browse all {total} shiurim
          </p>
        </div>

        {shiurim.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 text-center">
            <p className="text-gray-600">No shiurim available.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Link
                  href={`/archive?page=${Math.max(1, page - 1)}`}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    page === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                      : 'bg-white text-primary hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  Previous
                </Link>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (page <= 3) {
                      pageNum = i + 1
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = page - 2 + i
                    }
                    
                    return (
                      <Link
                        key={pageNum}
                        href={`/archive?page=${pageNum}`}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          pageNum === page
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-primary hover:bg-gray-50 border-gray-200'
                        }`}
                      >
                        {pageNum}
                      </Link>
                    )
                  })}
                </div>
                
                <Link
                  href={`/archive?page=${Math.min(totalPages, page + 1)}`}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    page === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                      : 'bg-white text-primary hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  Next
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

