import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

// --- Enums / Types ---
// (If we had enums supported natively in SQLite we'd use them, otherwise text constraints)

// --- Tables ---

export const users = sqliteTable('users', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    name: text('name'),
    role: text('role', { enum: ['admin', 'editor'] }).default('editor'), // Added role
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
})

export const series = sqliteTable('series', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
})

export const categories = sqliteTable('categories', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
})

export const shiurim = sqliteTable('shiurim', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    seriesId: text('series_id').references(() => series.id, { onDelete: 'set null' }),
    guid: text('guid').unique(), // Legacy ID from RSS/import, optional for new
    slug: text('slug').unique(),
    title: text('title').notNull(),
    description: text('description'),
    blurb: text('blurb'), // Short description for cards
    audioUrl: text('audio_url').notNull(),
    pdfUrl: text('pdf_url'), // Renamed from sourceDoc
    sourceContent: text('source_content'), // JSON or text content
    date: integer('date', { mode: 'timestamp' }).notNull(), // Renamed from pubDate
    duration: integer('duration'), // Seconds
    thumbnail: text('thumbnail'),
    viewCount: integer('view_count').default(0),
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
})

export const shiurimToCategories = sqliteTable('shiurim_to_categories', {
    shiurId: text('shiur_id').notNull().references(() => shiurim.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, (t) => ({
    pk: primaryKey({ columns: [t.shiurId, t.categoryId] }),
}))


export const platformLinks = sqliteTable('platform_links', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    shiurId: text('shiur_id').notNull().references(() => shiurim.id, { onDelete: 'cascade' }),
    youtube: text('youtube'),
    spotify: text('spotify'),
    apple: text('apple'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

// --- Relations ---

export const seriesRelations = relations(series, ({ many }) => ({
    shiurim: many(shiurim),
}))

export const shiurimRelations = relations(shiurim, ({ one, many }) => ({
    series: one(series, {
        fields: [shiurim.seriesId],
        references: [series.id],
    }),
    categories: many(shiurimToCategories),
}))

export const categoriesRelations = relations(categories, ({ many }) => ({
    shiurim: many(shiurimToCategories),
}))

export const shiurimToCategoriesRelations = relations(shiurimToCategories, ({ one }) => ({
    shiur: one(shiurim, {
        fields: [shiurimToCategories.shiurId],
        references: [shiurim.id],
    }),
    category: one(categories, {
        fields: [shiurimToCategories.categoryId],
        references: [categories.id],
    }),
}))


// --- Types ---

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Series = typeof series.$inferSelect
export type NewSeries = typeof series.$inferInsert

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert

export type Shiur = typeof shiurim.$inferSelect
export type NewShiur = typeof shiurim.$inferInsert
