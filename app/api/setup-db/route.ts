import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * One-time database setup endpoint
 * Call this once after deployment to set up your database schema
 * 
 * Usage: GET https://your-site.netlify.app/api/setup-db
 */
export async function GET() {
  try {
    // Test if tables exist
    await prisma.user.findFirst()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database schema is already set up' 
    })
  } catch (error: any) {
    // If tables don't exist, create them using raw SQL
    if (error.code === 'P2021' || error.code === '42P01' || error.message?.includes('does not exist')) {
      try {
        // Create tables using raw SQL from migration
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
        
        // Create indexes
        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
        `)
        
        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "Shiur_guid_key" ON "Shiur"("guid");
        `)
        
        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "PlatformLinks_shiurId_key" ON "PlatformLinks"("shiurId");
        `)
        
        // Create foreign key
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
        
        return NextResponse.json({ 
          success: true, 
          message: 'Database schema has been created successfully' 
        })
      } catch (createError: any) {
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to create database schema',
          details: createError.message 
        }, { status: 500 })
      }
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Database connection error',
      details: error.message,
      code: error.code
    }, { status: 500 })
  }
}

