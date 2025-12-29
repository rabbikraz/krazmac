import { eq } from 'drizzle-orm'
import { getDb } from './db'
import { users } from './schema'

/**
 * Hash password using Web Crypto API (Works in Workers runtime)
 * Replaces bcryptjs which doesn't work in edge runtime
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}

/**
 * Verify user credentials
 * @param d1 - D1 database instance
 * @param email - User email
 * @param password - Plain text password
 */
export async function verifyUser(
  d1: D1Database,
  email: string,
  password: string
) {
  const db = getDb(d1)

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (!user) {
    return null
  }

  const isValid = await verifyPassword(password, user.password)

  if (!isValid) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  }
}

/**
 * Create a new user
 * @param d1 - D1 database instance
 * @param email - User email
 * @param password - Plain text password (will be hashed)
 * @param name - Optional user name
 */
export async function createUser(
  d1: D1Database,
  email: string,
  password: string,
  name?: string
) {
  const db = getDb(d1)

  const hashedPassword = await hashPassword(password)

  const newUser = await db
    .insert(users)
    .values({
      email,
      password: hashedPassword,
      name,
    })
    .returning()
    .get()

  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
  }
}
