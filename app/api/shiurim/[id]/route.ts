import { NextRequest, NextResponse } from 'next/server'
import { getDb, getD1Database } from '@/lib/db'
import { shiurim, platformLinks, users } from '@/lib/schema'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const d1 = await getD1Database()

    if (!d1) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const db = getDb(d1)

    const shiur = await db
      .select()
      .from(shiurim)
      .where(eq(shiurim.id, id))
      .get()

    if (!shiur) {
      return NextResponse.json({ error: 'Shiur not found' }, { status: 404 })
    }

    // Fetch platform links
    const links = await db
      .select()
      .from(platformLinks)
      .where(eq(platformLinks.shiurId, id))
      .get()

    return NextResponse.json({
      ...shiur,
      platformLinks: links || null,
    })
  } catch (error) {
    console.error('Error fetching shiur:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const d1 = await getD1Database()

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
      title?: string
      slug?: string
      description?: string
      blurb?: string
      audioUrl?: string
      sourceDoc?: string | null
      sourcesJson?: string | null
      pubDate?: string
      duration?: string
      link?: string
      thumbnail?: string
      platformLinks?: any
    }
    const data = body

    const db = getDb(d1)

    // Update shiur
    const updateData: any = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.slug !== undefined) updateData.slug = data.slug || null
    if (data.description !== undefined) updateData.description = data.description
    if (data.blurb !== undefined) updateData.blurb = data.blurb
    if (data.audioUrl !== undefined) updateData.audioUrl = data.audioUrl
    if (data.sourceDoc !== undefined) updateData.sourceDoc = data.sourceDoc
    if (data.sourcesJson !== undefined) updateData.sourcesJson = data.sourcesJson
    if (data.pubDate !== undefined) updateData.pubDate = new Date(data.pubDate)
    if (data.duration !== undefined) updateData.duration = data.duration
    if (data.link !== undefined) updateData.link = data.link
    if (data.thumbnail !== undefined) updateData.thumbnail = data.thumbnail || null
    updateData.updatedAt = new Date()

    const updatedShiur = await db
      .update(shiurim)
      .set(updateData)
      .where(eq(shiurim.id, id))
      .returning()
      .get()

    // Update or create platform links
    if (data.platformLinks) {
      const existingLinks = await db
        .select()
        .from(platformLinks)
        .where(eq(platformLinks.shiurId, id))
        .get()

      if (existingLinks) {
        await db
          .update(platformLinks)
          .set({
            ...data.platformLinks,
            updatedAt: new Date(),
          })
          .where(eq(platformLinks.shiurId, id))
          .execute()
      } else {
        await db
          .insert(platformLinks)
          .values({
            shiurId: id,
            ...data.platformLinks,
          })
          .execute()
      }
    }

    // Fetch the updated shiur with links
    const links = await db
      .select()
      .from(platformLinks)
      .where(eq(platformLinks.shiurId, id))
      .get()

    return NextResponse.json({
      ...updatedShiur,
      platformLinks: links || null,
    })
  } catch (error) {
    console.error('Error updating shiur:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const d1 = await getD1Database()

    if (!d1) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    if (!(await isAuthenticated(d1))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getDb(d1)

    await db.delete(shiurim).where(eq(shiurim.id, id)).execute()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting shiur:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
