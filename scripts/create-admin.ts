import { prisma } from '../lib/prisma'
import { hashPassword } from '../lib/auth'

async function createAdmin() {
  const email = process.argv[2] || 'admin@example.com'
  const password = process.argv[3] || 'admin123'
  const name = process.argv[4] || 'Admin'

  if (!email || !password) {
    console.error('Usage: ts-node scripts/create-admin.ts <email> <password> [name]')
    process.exit(1)
  }

  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    })

    if (existing) {
      console.log('User already exists. Updating password...')
      const hashedPassword = await hashPassword(password)
      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      })
      console.log('Password updated successfully!')
    } else {
      const hashedPassword = await hashPassword(password)
      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
        },
      })
      console.log('Admin user created successfully!')
    }

    console.log(`Email: ${email}`)
    console.log(`Name: ${name}`)
  } catch (error) {
    console.error('Error creating admin user:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()

