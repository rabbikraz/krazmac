import { getDb } from './db'
import { shiurim } from './schema'
import { eq } from 'drizzle-orm'

/**
 * Parse duration string (HH:MM:SS or MM:SS) to seconds
 */
function parseDuration(duration: string): number {
  const parts = duration.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return parseInt(duration, 10) || 0
}


export interface RSSItem {
  guid: string
  title: string
  description?: string
  audioUrl: string
  pubDate: string
  duration?: string
  link?: string
}

/**
 * Edge-compatible RSS feed parser using fetch API
 * Replaces rss-parser which has Node.js dependencies
 */
export async function fetchRSSFeed(feedUrl: string): Promise<RSSItem[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`)
    }

    const xmlText = await response.text()

    // Simple XML parsing for RSS feeds
    const items: RSSItem[] = []

    // Match all <item> tags
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi
    let match

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXML = match[1]

      // Extract fields from each item
      const getTag = (tag: string): string => {
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
        const match = itemXML.match(regex)
        if (!match) return ''

        // Decode HTML entities and strip CDATA
        let content = match[1]
          .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")

        return content.trim()
      }

      // Get enclosure URL for audio
      const enclosureMatch = itemXML.match(/<enclosure[^>]+url="([^"]+)"/i)
      const audioUrl = enclosureMatch ? enclosureMatch[1] : getTag('link')

      // Get iTunes duration
      const durationMatch = itemXML.match(/<itunes:duration[^>]*>([^<]+)<\/itunes:duration>/i)
      const duration = durationMatch ? durationMatch[1] : ''

      const item: RSSItem = {
        guid: getTag('guid') || getTag('link'),
        title: getTag('title'),
        description: getTag('description') || getTag('content:encoded'),
        audioUrl: audioUrl,
        pubDate: getTag('pubDate'),
        duration: duration,
        link: getTag('link'),
      }

      // Only add valid items
      if (item.guid && item.title) {
        items.push(item)
      }
    }

    return items
  } catch (error) {
    console.error('Error fetching RSS feed:', error)
    throw error
  }
}

/**
 * Sync RSS feed items to D1 database
 */
export async function syncRSSFeed(d1: D1Database, feedUrl: string) {
  const items = await fetchRSSFeed(feedUrl)
  const db = await getDb(d1)
  const synced: string[] = []
  const errors: { guid: string, message: string }[] = []

  for (const item of items) {
    try {
      // Check if shiur already exists
      const existing = await db
        .select()
        .from(shiurim)
        .where(eq(shiurim.guid, item.guid))
        .get()

      if (existing) {
        // Update existing shiur
        await db
          .update(shiurim)
          .set({
            title: item.title,
            description: item.description,
            audioUrl: item.audioUrl,
            date: new Date(item.pubDate),
            duration: item.duration ? parseDuration(item.duration) : null,
            updatedAt: new Date(),
          })
          .where(eq(shiurim.guid, item.guid))
          .execute()

        synced.push(item.guid)
      } else {
        // Create new shiur
        await db
          .insert(shiurim)
          .values({
            guid: item.guid,
            title: item.title,
            description: item.description,
            audioUrl: item.audioUrl,
            date: new Date(item.pubDate),
            duration: item.duration ? parseDuration(item.duration) : null,
          })
          .execute()

        synced.push(item.guid)
      }
    } catch (error) {
      console.error(`Error syncing item ${item.guid}:`, error)
      const msg = error instanceof Error ? error.message : String(error)
      errors.push({ guid: item.guid, message: msg })
    }
  }

  return { synced, errors, total: items.length }
}
