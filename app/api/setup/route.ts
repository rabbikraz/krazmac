import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Complete setup endpoint - sets up database and creates admin user
 * Call this once after deployment
 * 
 * Usage: GET https://your-site.netlify.app/api/setup
 */
export async function GET() {
  try {
    // Step 1: Set up database tables
    try {
      await prisma.user.findFirst()
    } catch (error: any) {
      // Tables don't exist, create them
      if (error.code === 'P2021' || error.code === '42P01' || error.message?.includes('does not exist')) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "User" (
            "id" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "password" TEXT NOT NULL,
            "name" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "User_pkey" PRIMARY KEY ("id")
          );
        `)
        
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "Shiur" (
            "id" TEXT NOT NULL,
            "guid" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "description" TEXT,
            "blurb" TEXT,
            "audioUrl" TEXT NOT NULL,
            "sourceDoc" TEXT,
            "pubDate" TIMESTAMP(3) NOT NULL,
            "duration" TEXT,
            "link" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "Shiur_pkey" PRIMARY KEY ("id")
          );
        `)
        
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "PlatformLinks" (
            "id" TEXT NOT NULL,
            "shiurId" TEXT NOT NULL,
            "youtube" TEXT,
            "youtubeMusic" TEXT,
            "spotify" TEXT,
            "apple" TEXT,
            "amazon" TEXT,
            "pocket" TEXT,
            "twentyFourSix" TEXT,
            "castbox" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "PlatformLinks_pkey" PRIMARY KEY ("id")
          );
        `)
        
        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
        `)
        
        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "Shiur_guid_key" ON "Shiur"("guid");
        `)
        
        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "PlatformLinks_shiurId_key" ON "PlatformLinks"("shiurId");
        `)
        
        await prisma.$executeRawUnsafe(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'PlatformLinks_shiurId_fkey'
            ) THEN
              ALTER TABLE "PlatformLinks" 
              ADD CONSTRAINT "PlatformLinks_shiurId_fkey" 
              FOREIGN KEY ("shiurId") REFERENCES "Shiur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
          END $$;
        `)
      }
    }
    
    // Step 2: Create admin user
    const email = 'admin@rabbikraz.com'
    const password = 'admin123'
    const name = 'Admin'
    
    let user
    try {
      // Check if user exists
      user = await prisma.user.findUnique({
        where: { email }
      })
      
      if (!user) {
        // Create user
        user = await createUser(email, password, name)
      }
    } catch (error: any) {
      if (error.code === 'P2002') {
        // User already exists, that's fine
        user = await prisma.user.findUnique({
          where: { email }
        })
      } else {
        throw error
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Setup complete!',
      database: 'Tables created',
      admin: user ? {
        email: user.email,
        name: user.name,
        exists: true
      } : 'Created'
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: 'Setup failed',
      details: error.message,
      code: error.code
    }, { status: 500 })
  }
}

