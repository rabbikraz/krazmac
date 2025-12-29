import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { shiurim, platformLinks, users } from '@/lib/schema'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { desc } from 'drizzle-orm'

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

export async function GET(request: NextRequest) {
  try {
    // @ts-ignore - Cloudflare Workers types
    const d1: D1Database = request.env?.DB || (globalThis as any).DB

    if (!d1) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const db = getDb(d1)

    // Fetch all shiurim with their platform links
    const allShiurim = await db
      .select()
      .from(shiurim)
      .orderBy(desc(shiurim.pubDate))
      .all()

    // Fetch platform links separately
    const shiurimWithLinks = await Promise.all(
      allShiurim.map(async (shiur) => {
        const links = await db
          .select()
          .from(platformLinks)
          .where(eq(platformLinks.shiurId, shiur.id))
          .get()

        return {
          ...shiur,
          platformLinks: links || null,
        }
      })
    )

    return NextResponse.json(shiurimWithLinks)
  } catch (error) {
    console.error('Error fetching shiurim:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
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

    const body = await request.json() as {
      guid: string
      title: string
      description?: string
      blurb?: string
      audioUrl: string
      sourceDoc?: string
      pubDate: string
      duration?: string
      link?: string
      platformLinks?: any
    }
    const data = body

    const db = getDb(d1)

    // Create the shiur
    const newShiur = await db
      .insert(shiurim)
      .values({
        guid: data.guid,
        title: data.title,
        description: data.description,
        blurb: data.blurb,
        audioUrl: data.audioUrl,
        sourceDoc: data.sourceDoc,
        pubDate: new Date(data.pubDate),
        duration: data.duration,
        link: data.link,
      })
      .returning()
      .get()

    // Create platform links if provided
    let links = null
    if (data.platformLinks) {
      links = await db
        .insert(platformLinks)
        .values({
          shiurId: newShiur.id,
          ...data.platformLinks,
        })
        .returning()
        .get()
    }

    return NextResponse.json({
      ...newShiur,
      platformLinks: links,
    })
  } catch (error) {
    console.error('Error creating shiur:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

