import { NextRequest, NextResponse } from 'next/server'
import { verifyUser } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Check if DATABASE_URL or SUPABASE_DATABASE_URL is configured
    if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
      console.error('DATABASE_URL or SUPABASE_DATABASE_URL is not configured')
      return NextResponse.json(
        { error: 'Database not configured. Please check your environment variables.' },
        { status: 500 }
      )
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const user = await verifyUser(email, password)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Set a simple session cookie (in production, use proper session management)
    const cookieStore = await cookies()
    cookieStore.set('admin-session', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email } })
  } catch (error: any) {
    console.error('Login error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL ? 'SET' : 'NOT SET',
    })
    
    // Return detailed error for debugging
    const errorMessage = error.message || 'Database connection error'
    
    return NextResponse.json(
      { 
        error: 'Internal server error. Please check your database connection.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('admin-session')
  return NextResponse.json({ success: true })
}

