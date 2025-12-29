// Setup script to ensure DATABASE_URL is correctly formatted for Supabase
// This runs before Prisma commands during build

console.log('🔧 Configuring Supabase database connection...')

// Extract project ID from SUPABASE_DATABASE_URL (project URL)
let projectId = null
const supabaseProjectUrl = process.env.SUPABASE_DATABASE_URL
if (supabaseProjectUrl) {
  const match = supabaseProjectUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
  if (match) {
    projectId = match[1]
    console.log(`✅ Extracted project ID: ${projectId}`)
  }
}

// Get existing DATABASE_URL
let dbUrl = process.env.DATABASE_URL

if (!dbUrl || !dbUrl.startsWith('postgres')) {
  console.error('❌ DATABASE_URL not found or invalid')
  console.warn('⚠️  Migrations will be skipped')
  process.exit(0) // Don't fail build, just skip migrations
}

console.log('✅ Found DATABASE_URL')

// Parse the connection string
try {
  const url = new URL(dbUrl.replace(/^postgresql?:\/\//, 'https://'))
  const password = url.password
  const host = url.hostname
  const port = url.port || (url.hostname.includes('pooler') ? '6543' : '5432')
  
  // Determine if this is a pooler connection
  const isPooler = port === '6543' || host.includes('pooler')
  
  // For pooler connections, username MUST be postgres.PROJECT_REF
  let username = url.username
  if (isPooler && projectId && !username.includes('.')) {
    username = `postgres.${projectId}`
    console.log(`✅ Fixed username for pooler: ${username}`)
  }
  
  // Construct the correct connection string
  const protocol = dbUrl.startsWith('postgresql://') ? 'postgresql' : 'postgres'
  let newUrl = `${protocol}://${username}:${password}@${host}:${port}${url.pathname}`
  
  // Add required parameters
  const params = new URLSearchParams()
  
  // Add existing query parameters
  if (url.search) {
    url.search.slice(1).split('&').forEach(param => {
      const [key, value] = param.split('=')
      if (key) params.set(key, value || '')
    })
  }
  
  // Add pgbouncer for pooler
  if (isPooler && !params.has('pgbouncer')) {
    params.set('pgbouncer', 'true')
  }
  
  // Add SSL mode for Supabase
  if ((host.includes('supabase.co') || host.includes('supabase.com')) && !params.has('sslmode')) {
    params.set('sslmode', 'require')
  }
  
  // Append parameters
  if (params.toString()) {
    newUrl += '?' + params.toString()
  }
  
  // Set the corrected DATABASE_URL
  process.env.DATABASE_URL = newUrl
  console.log('✅ DATABASE_URL configured correctly')
  console.log(`   Host: ${host}:${port}`)
  console.log(`   Username: ${username}`)
  console.log(`   Pooler: ${isPooler ? 'yes' : 'no'}`)
  
} catch (error) {
  console.error('❌ Error parsing DATABASE_URL:', error.message)
  console.warn('⚠️  Using original DATABASE_URL as-is')
}
