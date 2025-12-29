import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Check if DATABASE_URL or SUPABASE_DATABASE_URL is configured
    if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
      console.error('DATABASE_URL or SUPABASE_DATABASE_URL is not configured')
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

    const user = await prisma.user.findUnique({
      where: { id: session.value },
    })

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email } })
  } catch (error: any) {
    console.error('Auth check error:', error)
    // Return more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error.message || 'Database connection error'
      : 'Internal server error'
    
    return NextResponse.json(
      { error: errorMessage, authenticated: false },
      { status: 500 }
    )
  }
}

