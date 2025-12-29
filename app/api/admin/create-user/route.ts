import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * One-time admin user creation endpoint
 * Protected by ADMIN_SETUP_TOKEN environment variable
 * 
 * Usage: POST /api/admin/create-user
 * Headers: { "X-Setup-Token": "your-admin-setup-token" }
 * Body: { "email": "admin@example.com", "password": "secure-password", "name": "Admin" }
 * 
 * After creating your admin user, you can remove this endpoint or disable it
 * by removing the ADMIN_SETUP_TOKEN from your environment variables.
 */
export async function POST(request: NextRequest) {
  try {
    // Check for setup token
    const setupToken = request.headers.get('X-Setup-Token')
    const expectedToken = process.env.ADMIN_SETUP_TOKEN

    if (!expectedToken) {
      return NextResponse.json(
        { error: 'Admin setup is not configured. Please set ADMIN_SETUP_TOKEN environment variable.' },
        { status: 500 }
      )
    }

    if (setupToken !== expectedToken) {
      return NextResponse.json(
        { error: 'Invalid setup token' },
        { status: 401 }
      )
    }

    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Create the admin user
    const user = await createUser(email, password, name || 'Admin')

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      user: { id: user.id, email: user.email, name: user.name }
    })
  } catch (error: any) {
    console.error('Create admin user error:', error)
    
    // Handle unique constraint violation (user already exists)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create admin user', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    )
  }
}

