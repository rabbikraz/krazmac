#!/usr/bin/env node

/**
 * Environment Variables Verification Script
 * 
 * Run this script to verify all required environment variables are set
 * before deploying to Netlify.
 * 
 * Usage:
 *   node scripts/verify-env.js
 *   node scripts/verify-env.js --production (for production checks)
 */

const requiredVars = {
  DATABASE_URL: {
    required: true,
    description: 'Supabase PostgreSQL connection string',
    validate: (value) => {
      if (!value) return { valid: false, error: 'Not set' }
      if (!value.startsWith('postgres')) {
        return { valid: false, error: 'Must start with postgres:// or postgresql://' }
      }
      try {
        const url = new URL(value.replace(/^postgresql?:\/\//, 'https://'))
        if (!url.hostname) {
          return { valid: false, error: 'Invalid connection string format' }
        }
        return { valid: true }
      } catch (e) {
        return { valid: false, error: 'Invalid URL format' }
      }
    }
  },
  SUPABASE_DATABASE_URL: {
    required: false,
    description: 'Supabase project URL (optional but recommended)',
    validate: (value) => {
      if (!value) return { valid: true, warning: 'Not set (optional but recommended)' }
      if (!value.includes('supabase.co') && !value.includes('supabase.com')) {
        return { valid: false, error: 'Should be a Supabase project URL' }
      }
      return { valid: true }
    }
  },
  NEXTAUTH_URL: {
    required: true,
    description: 'Base URL for authentication',
    validate: (value) => {
      if (!value) return { valid: false, error: 'Not set' }
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return { valid: false, error: 'Must be a valid URL starting with http:// or https://' }
      }
      if (value.includes('localhost') && process.env.NODE_ENV === 'production') {
        return { valid: true, warning: 'Using localhost in production is not recommended' }
      }
      return { valid: true }
    }
  },
  NEXTAUTH_SECRET: {
    required: true,
    description: 'Secret key for JWT tokens',
    validate: (value) => {
      if (!value) return { valid: false, error: 'Not set' }
      if (value.length < 32) {
        return { valid: true, warning: 'Should be at least 32 characters for security' }
      }
      if (value === 'your-secret-key-here' || value === 'change-me') {
        return { valid: false, error: 'Must be changed from default value' }
      }
      return { valid: true }
    }
  },
  RSS_FEED_URL: {
    required: true,
    description: 'RSS feed URL for shiurim',
    validate: async (value) => {
      if (!value) return { valid: false, error: 'Not set' }
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return { valid: false, error: 'Must be a valid URL' }
      }
      // Try to fetch the RSS feed to verify it's accessible
      try {
        const response = await fetch(value, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
        if (!response.ok) {
          return { valid: true, warning: `RSS feed returned status ${response.status}` }
        }
        return { valid: true }
      } catch (e) {
        return { valid: true, warning: `Could not verify RSS feed accessibility: ${e.message}` }
      }
    }
  },
  NEXT_PUBLIC_BASE_URL: {
    required: false,
    description: 'Public base URL (optional)',
    validate: (value) => {
      if (!value) return { valid: true, warning: 'Not set (optional)' }
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return { valid: false, error: 'Must be a valid URL' }
      }
      return { valid: true }
    }
  },
  YOUTUBE_API_KEY: {
    required: false,
    description: 'YouTube Data API key (optional, for playlists/videos)',
    validate: (value) => {
      if (!value) return { valid: true, warning: 'Not set (optional, needed for YouTube features)' }
      if (value.length < 20) {
        return { valid: false, error: 'API key seems too short' }
      }
      return { valid: true }
    }
  },
  ADMIN_SETUP_TOKEN: {
    required: false,
    description: 'Admin setup token (temporary, for initial setup)',
    validate: (value) => {
      if (!value) return { valid: true, warning: 'Not set (optional, needed for initial admin creation)' }
      if (value.length < 32) {
        return { valid: true, warning: 'Should be at least 32 characters for security' }
      }
      return { valid: true }
    }
  }
}

const isProduction = process.argv.includes('--production') || process.env.NODE_ENV === 'production'

async function verifyEnvironment() {
  console.log('🔍 Verifying Environment Variables...\n')
  console.log(`Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}\n`)

  const results = {
    valid: [],
    warnings: [],
    errors: []
  }

  for (const [varName, config] of Object.entries(requiredVars)) {
    const value = process.env[varName]
    const isSet = value !== undefined && value !== ''
    
    console.log(`Checking ${varName}...`)
    console.log(`  Description: ${config.description}`)
    console.log(`  Required: ${config.required ? 'Yes' : 'No'}`)
    console.log(`  Set: ${isSet ? 'Yes' : 'No'}`)
    
    if (!isSet) {
      if (config.required) {
        console.log(`  ❌ ERROR: Required variable is not set\n`)
        results.errors.push({ var: varName, message: 'Required variable is not set' })
        continue
      } else {
        console.log(`  ⚠️  WARNING: Optional variable is not set\n`)
        results.warnings.push({ var: varName, message: 'Optional variable is not set' })
        continue
      }
    }

    // Mask sensitive values
    const displayValue = varName.includes('SECRET') || varName.includes('TOKEN') || varName.includes('PASSWORD') || varName.includes('KEY')
      ? '*'.repeat(Math.min(value.length, 20)) + (value.length > 20 ? '...' : '')
      : value

    console.log(`  Value: ${displayValue}`)

    // Validate the value
    const validation = await config.validate(value)
    
    if (!validation.valid) {
      console.log(`  ❌ ERROR: ${validation.error}\n`)
      results.errors.push({ var: varName, message: validation.error })
    } else if (validation.warning) {
      console.log(`  ⚠️  WARNING: ${validation.warning}\n`)
      results.warnings.push({ var: varName, message: validation.warning })
    } else {
      console.log(`  ✅ Valid\n`)
      results.valid.push(varName)
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Valid: ${results.valid.length}`)
  console.log(`⚠️  Warnings: ${results.warnings.length}`)
  console.log(`❌ Errors: ${results.errors.length}`)
  console.log('='.repeat(60) + '\n')

  if (results.warnings.length > 0) {
    console.log('⚠️  WARNINGS:')
    results.warnings.forEach(({ var: varName, message }) => {
      console.log(`  - ${varName}: ${message}`)
    })
    console.log('')
  }

  if (results.errors.length > 0) {
    console.log('❌ ERRORS (must be fixed before deployment):')
    results.errors.forEach(({ var: varName, message }) => {
      console.log(`  - ${varName}: ${message}`)
    })
    console.log('')
    console.log('❌ Environment verification FAILED')
    process.exit(1)
  }

  if (results.warnings.length > 0 && isProduction) {
    console.log('⚠️  Some optional variables are not set, but deployment can proceed.')
  }

  console.log('✅ Environment verification PASSED')
  console.log('\n💡 Next steps:')
  console.log('   1. Review any warnings above')
  console.log('   2. Set all required variables in Netlify')
  console.log('   3. Deploy your site')
  console.log('   4. Test the deployed site')
  console.log('   5. Create admin user if needed')
}

// Run verification
verifyEnvironment().catch((error) => {
  console.error('❌ Verification script error:', error)
  process.exit(1)
})


