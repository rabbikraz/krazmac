import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Fix connection string at runtime (same logic as setup-env.js)
function fixConnectionString() {
  if (!process.env.DATABASE_URL) return
  
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl.startsWith('postgres')) return
  
  // Extract project ID from SUPABASE_DATABASE_URL
  let projectId = null
  const supabaseUrl = process.env.SUPABASE_DATABASE_URL
  if (supabaseUrl) {
    const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
    if (match) projectId = match[1]
  }
  
  try {
    const url = new URL(dbUrl.replace(/^postgresql?:\/\//, 'https://'))
    const isPooler = url.port === '6543' || url.hostname.includes('pooler')
    
    // Fix username for pooler
    if (isPooler && projectId && !url.username.includes('.')) {
      const password = url.password
      const host = url.hostname
      const port = url.port || '6543'
      const path = url.pathname
      
      let newUrl = `postgresql://postgres.${projectId}:${password}@${host}:${port}${path}`
      
      // Add required params
      const params = new URLSearchParams()
      if (url.search) {
        url.search.slice(1).split('&').forEach(param => {
          const [key, value] = param.split('=')
          if (key) params.set(key, value || '')
        })
      }
      if (!params.has('pgbouncer')) params.set('pgbouncer', 'true')
      if (!params.has('sslmode') && (host.includes('supabase.co') || host.includes('supabase.com'))) {
        params.set('sslmode', 'require')
      }
      
      if (params.toString()) newUrl += '?' + params.toString()
      process.env.DATABASE_URL = newUrl
    }
  } catch (e) {
    // Ignore parsing errors
  }
}

// Fix connection string before creating Prisma client
fixConnectionString()

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

