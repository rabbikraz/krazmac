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

    // Check if we're setting a new slug that should become the ID
    let newId = id
    if (data.slug && data.slug !== id) {
      newId = data.slug
    }

    // Build update data
    const updateData: any = {}
    if (data.title !== undefined) updateData.title = data.title
    // Slug column is always null if ID serves as the slug.
    updateData.slug = null

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

    let updatedShiur

    if (newId !== id) {
      // 1. Get current shiur data BEFORE doing anything
      const currentShiur = await db
        .select()
        .from(shiurim)
        .where(eq(shiurim.id, id))
        .get()

      if (currentShiur) {
        // 2. Insert new record with new ID first
        await db.insert(shiurim).values({
          id: newId,
          guid: currentShiur.guid,
          slug: null, // ID is now the slug
          title: data.title ?? currentShiur.title,
          description: data.description ?? currentShiur.description,
          blurb: data.blurb ?? currentShiur.blurb,
          audioUrl: data.audioUrl ?? currentShiur.audioUrl,
          sourceDoc: data.sourceDoc ?? currentShiur.sourceDoc,
          sourcesJson: data.sourcesJson ?? currentShiur.sourcesJson,
          pubDate: data.pubDate ? new Date(data.pubDate) : currentShiur.pubDate,
          duration: data.duration ?? currentShiur.duration,
          link: data.link ?? currentShiur.link,
          thumbnail: data.thumbnail ?? currentShiur.thumbnail,
          createdAt: currentShiur.createdAt,
          updatedAt: new Date(),
        }).execute()

        // 3. Update platform_links to point to new ID
        await db
          .update(platformLinks)
          .set({ shiurId: newId })
          .where(eq(platformLinks.shiurId, id))
          .execute()

        // 4. Delete old record
        await db.delete(shiurim).where(eq(shiurim.id, id)).execute()

        updatedShiur = await db.select().from(shiurim).where(eq(shiurim.id, newId)).get()
      } else {
        return NextResponse.json({ error: 'Shiur not found' }, { status: 404 })
      }
    } else {
      // Normal update without ID change
      updatedShiur = await db
        .update(shiurim)
        .set(updateData)
        .where(eq(shiurim.id, id))
        .returning()
        .get()
    }

    // Update or create platform links - use newId since ID may have changed
    if (data.platformLinks) {
      const existingLinks = await db
        .select()
        .from(platformLinks)
        .where(eq(platformLinks.shiurId, newId))
        .get()

      if (existingLinks) {
        await db
          .update(platformLinks)
          .set({
            ...data.platformLinks,
            updatedAt: new Date(),
          })
          .where(eq(platformLinks.shiurId, newId))
          .execute()
      } else {
        await db
          .insert(platformLinks)
          .values({
            shiurId: newId,
            ...data.platformLinks,
          })
          .execute()
      }
    }

    // Fetch the updated shiur with links
    const links = await db
      .select()
      .from(platformLinks)
      .where(eq(platformLinks.shiurId, newId))
      .get()

    return NextResponse.json({
      ...updatedShiur,
      newId: newId !== id ? newId : undefined, // Return new ID if changed so frontend can redirect
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
