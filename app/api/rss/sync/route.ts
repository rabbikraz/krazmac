import { NextRequest, NextResponse } from 'next/server'
import { syncRSSFeed } from '@/lib/rss-parser'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'edge'

async function isAuthenticated(d1: D1Database) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin-session')
  if (!session) return false

  const db = getDb(d1)
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.value))
    .get()

  return !!user
}


export async function POST(request: NextRequest) {
  try {
    // @ts-ignore - Cloudflare Workers types
    const d1: D1Database = request.env?.DB || (globalThis as any).DB

    if (!d1) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    if (!(await isAuthenticated(d1))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as { feedUrl?: string }
    const { feedUrl } = body
    const url = feedUrl || process.env.RSS_FEED_URL

    if (!url) {
      return NextResponse.json(
        { error: 'RSS feed URL is required' },
        { status: 400 }
      )
    }

    const result = await syncRSSFeed(d1, url)

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

