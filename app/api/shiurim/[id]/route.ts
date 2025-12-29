import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

async function isAuthenticated() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin-session')
  if (!session) return false
  
  const user = await prisma.user.findUnique({
    where: { id: session.value },
  })
  return !!user
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const shiur = await prisma.shiur.findUnique({
      where: { id: params.id },
      include: {
        platformLinks: true,
      },
    })

    if (!shiur) {
      return NextResponse.json({ error: 'Shiur not found' }, { status: 404 })
    }

    return NextResponse.json(shiur)
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
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    // Update shiur
    const shiur = await prisma.shiur.update({
      where: { id: params.id },
      data: {
        title: data.title,
        description: data.description,
        blurb: data.blurb,
        audioUrl: data.audioUrl,
        sourceDoc: data.sourceDoc,
        pubDate: data.pubDate ? new Date(data.pubDate) : undefined,
        duration: data.duration,
        link: data.link,
      },
      include: {
        platformLinks: true,
      },
    })

    // Update or create platform links
    if (data.platformLinks) {
      await prisma.platformLinks.upsert({
        where: { shiurId: params.id },
        create: {
          shiurId: params.id,
          ...data.platformLinks,
        },
        update: data.platformLinks,
      })
    }

    const updatedShiur = await prisma.shiur.findUnique({
      where: { id: params.id },
      include: {
        platformLinks: true,
      },
    })

    return NextResponse.json(updatedShiur)
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
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.shiur.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting shiur:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

