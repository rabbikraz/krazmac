import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/auth'

export const runtime = 'edge'

/**
 * One-time admin user creation endpoint
 * Protected by ADMIN_SETUP_TOKEN environment variable
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

    // @ts-ignore - Cloudflare Workers types
    const d1: D1Database = request.env?.DB || (globalThis as any).DB

    if (!d1) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const body = await request.json() as { email: string; password: string; name?: string }
    const { email, password, name } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Create the admin user
    const user = await createUser(d1, email, password, name || 'Admin')

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      user: { id: user.id, email: user.email, name: user.name }
    })
  } catch (error: any) {
    console.error('Create admin user error:', error)

    // Handle unique constraint violation
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to create admin user',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
