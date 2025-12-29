import { NextRequest, NextResponse } from 'next/server'
import { syncRSSFeed } from '@/lib/rss-parser'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

async function isAuthenticated() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin-session')
  if (!session) return false
  
  const user = await prisma.user.findUnique({
    where: { id: session.value },
  })
  return !!user
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { feedUrl } = await request.json()
    const url = feedUrl || process.env.RSS_FEED_URL

    if (!url) {
      return NextResponse.json(
        { error: 'RSS feed URL is required' },
        { status: 400 }
      )
    }

    const result = await syncRSSFeed(url)

    return NextResponse.json({
      success: true,
      synced: result.synced.length,
      errors: result.errors.length,
      total: result.total,
    })
  } catch (error) {
    console.error('Error syncing RSS feed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

