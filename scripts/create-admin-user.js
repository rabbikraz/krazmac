/**
 * Script to create admin user directly
 * Run this after setting up the database
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function createAdmin() {
  const prisma = new PrismaClient()
  
  try {
    const email = 'admin@rabbikraz.com'
    const password = 'admin123'
    const name = 'Admin'
    
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existing) {
      console.log('✅ Admin user already exists!')
      console.log(`   Email: ${email}`)
      return
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      }
    })
    
    console.log('✅ Admin user created successfully!')
    console.log(`   Email: ${email}`)
    console.log(`   Password: ${password}`)
    console.log(`   ID: ${user.id}`)
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message)
    
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.error('\n⚠️  Database tables do not exist yet!')
      console.error('   Please visit: https://krazz.netlify.app/api/setup-db')
      console.error('   Then run this script again.')
    }
    
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()

