# Cloudflare Workers Deployment Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Login to Cloudflare
```bash
npm run cf:login
```

### 3. Create D1 Database
```bash
npm run cf:d1:create
```

This will output a database ID. Copy it and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "rabbi-kraz-db"
database_id = "YOUR_DATABASE_ID_HERE"  # Paste the ID here
```

### 4. Run Migrations
```bash
wrangler d1 migrations apply rabbi-kraz-db --remote
```

### 5. Set Environment Variables

In Cloudflare dashboard (or via wrangler):
```bash
# Required
wrangler secret put NEXTAUTH_SECRET
wrangler secret put ADMIN_SETUP_TOKEN

# Optional (for YouTube features)
wrangler secret put YOUTUBE_API_KEY
```

Or set in wrangler.toml for non-secrets:
```toml
[vars]
RSS_FEED_URL = "https://anchor.fm/s/d89491c4/podcast/rss"
NEXT_PUBLIC_BASE_URL = "https://your-site.pages.dev"
```

### 6. Build and Deploy
```bash
npm run deploy
```

## Local Development

### With Wrangler (Recommended)
```bash
npm run preview
```

This builds the Next.js app for Cloudflare and runs it locally with wrangler.

### With Next.js Dev Server
```bash
npm run dev
```

Note: This won't have access to D1 database locally. Use wrangler preview for full testing.

## Creating Admin User

After deployment, create an admin user:

```bash
curl -X POST https://your-site.pages.dev/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: your-admin-setup-token" \
  -d '{
    "email": "admin@example.com",
    "password": "secure-password",
    "name": "Admin"
  }'
```

## Database Management

### View Database
```bash
wrangler d1 execute rabbi-kraz-db --remote --command="SELECT * FROM users LIMIT 10"
```

### Backup Database
```bash
wrangler d1 export rabbi-kraz-db --remote --output=backup.sql
```

### Import Data
```bash
wrangler d1 execute rabbi-kraz-db --remote --file=backup.sql
```

## Architecture

- **Framework**: Next.js 14 with App Router
- **Runtime**: Cloudflare Workers (Edge)
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Auth**: Web Crypto API (edge-compatible)

## Key Differences from Netlify Version

1. **Database**: PostgreSQL/Prisma → D1/Drizzle
2. **Auth**: bcryptjs → Web Crypto API (SHA-256)
3. **Runtime**: Node.js → Edge/Workers
4. **Deployment**: Netlify → Cloudflare Pages

## Troubleshooting

### Build Errors
- Ensure all Node.js APIs are replaced with Web APIs
- Check that all imports are edge-compatible

### Database Errors
- Verify D1 binding is correct in wrangler.toml
- Check migrations have been applied

### Authentication Issues
- Ensure NEXTAUTH_SECRET is set
- Verify cookies are being set (check browser DevTools)
