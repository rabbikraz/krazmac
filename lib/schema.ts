import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    name: text('name'),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date()),
})

export const shiurim = sqliteTable('shiurim', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    guid: text('guid').notNull().unique(),
    slug: text('slug').unique(), // Custom URL path, must be unique
    title: text('title').notNull(),
    description: text('description'),
    blurb: text('blurb'),
    audioUrl: text('audio_url').notNull(),
    sourceDoc: text('source_doc'), // URL to PDF (Google Drive, etc.)
    sourcesJson: text('sources_json'), // JSON array of clipped sources from SourceManager
    pubDate: integer('pub_date', { mode: 'timestamp' }).notNull(),
    duration: text('duration'),
    link: text('link'),
    thumbnail: text('thumbnail'), // URL to thumbnail image for social sharing
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date()),
})

export const platformLinks = sqliteTable('platform_links', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    shiurId: text('shiur_id')
        .notNull()
        .unique()
        .references(() => shiurim.id, { onDelete: 'cascade' }),
    youtube: text('youtube'),
    youtubeMusic: text('youtube_music'),
    spotify: text('spotify'),
    apple: text('apple'),
    amazon: text('amazon'),
    pocket: text('pocket'),
    twentyFourSix: text('twenty_four_six'),
    castbox: text('castbox'),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date()),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Shiur = typeof shiurim.$inferSelect
export type NewShiur = typeof shiurim.$inferInsert

export type PlatformLink = typeof platformLinks.$inferSelect
export type NewPlatformLink = typeof platformLinks.$inferInsert
