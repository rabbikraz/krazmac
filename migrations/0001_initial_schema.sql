-- Migration: Create initial schema for D1
-- Created: 2025-12-28

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shiurim (
    id TEXT PRIMARY KEY NOT NULL,
    guid TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    blurb TEXT,
    audio_url TEXT NOT NULL,
    source_doc TEXT,
    pub_date INTEGER NOT NULL,
    duration TEXT,
    link TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_links (
    id TEXT PRIMARY KEY NOT NULL,
    shiur_id TEXT NOT NULL UNIQUE,
    youtube TEXT,
    youtube_music TEXT,
    spotify TEXT,
    apple TEXT,
    amazon TEXT,
    pocket TEXT,
    twenty_four_six TEXT,
    castbox TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (shiur_id) REFERENCES shiurim(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_shiurim_guid ON shiurim(guid);
CREATE INDEX IF NOT EXISTS idx_shiurim_pub_date ON shiurim(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_platform_links_shiur_id ON platform_links(shiur_id);
