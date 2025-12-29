import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    // @ts-ignore - Cloudflare Workers types
    const d1: D1Database = request.env?.DB || (globalThis as any).DB

    if (!d1) {
      return NextResponse.json(
        { error: 'Database not configured', authenticated: false },
        { status: 500 }
      )
    }

    const cookieStore = await cookies()
    const session = cookieStore.get('admin-session')

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const db = getDb(d1)
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, session.value))
      .get()

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email, name: user.name }
    })
  } catch (error: any) {
    console.error('Auth check error:', error)

    return NextResponse.json(
      {
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        authenticated: false
      },
      { status: 500 }
    )
  }
}
