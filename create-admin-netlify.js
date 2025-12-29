// Run this with: node create-admin-netlify.js your-email@example.com your-password
// Make sure DATABASE_URL is set in your environment

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdmin() {
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.error('Usage: node create-admin-netlify.js <email> <password>')
    console.error('Make sure DATABASE_URL is set in your environment')
    process.exit(1)
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12)
    
    const existing = await prisma.user.findUnique({
      where: { email },
    })

    if (existing) {
      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      })
      console.log('✅ Admin password updated!')
    } else {
      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: 'Admin',
        },
      })
      console.log('✅ Admin user created!')
    }

    console.log(`Email: ${email}`)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()

