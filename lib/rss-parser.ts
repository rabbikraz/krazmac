import Parser from 'rss-parser'
import { prisma } from './prisma'

const parser = new Parser()

export interface RSSItem {
  guid: string
  title: string
  description?: string
  audioUrl: string
  pubDate: string
  duration?: string
  link?: string
}

export async function fetchRSSFeed(feedUrl: string): Promise<RSSItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl)
    
    if (!feed.items) {
      return []
    }

    return feed.items.map((item) => {
      const enclosure = item.enclosure
      const audioUrl = enclosure?.url || item.link || ''
      
      // Extract duration from itunes:duration or content
      let duration = item.itunes?.duration || ''
      
      return {
        guid: item.guid || item.id || item.link || '',
        title: item.title || '',
        description: item.contentSnippet || item.content || item.description || '',
        audioUrl,
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        duration,
        link: item.link || '',
      }
    })
  } catch (error) {
    console.error('Error fetching RSS feed:', error)
    throw error
  }
}

export async function syncRSSFeed(feedUrl: string) {
  const items = await fetchRSSFeed(feedUrl)
  const synced: string[] = []
  const errors: string[] = []

  for (const item of items) {
    try {
      // Check if shiur already exists
      const existing = await prisma.shiur.findUnique({
        where: { guid: item.guid },
      })

      if (existing) {
        // Update existing shiur
        await prisma.shiur.update({
          where: { guid: item.guid },
          data: {
            title: item.title,
            description: item.description,
            audioUrl: item.audioUrl,
            pubDate: new Date(item.pubDate),
            duration: item.duration,
            link: item.link,
          },
        })
        synced.push(item.guid)
      } else {
        // Create new shiur
        await prisma.shiur.create({
          data: {
            guid: item.guid,
            title: item.title,
            description: item.description,
            audioUrl: item.audioUrl,
            pubDate: new Date(item.pubDate),
            duration: item.duration,
            link: item.link,
          },
        })
        synced.push(item.guid)
      }
    } catch (error) {
      console.error(`Error syncing item ${item.guid}:`, error)
      errors.push(item.guid)
    }
  }

  return { synced, errors, total: items.length }
}

