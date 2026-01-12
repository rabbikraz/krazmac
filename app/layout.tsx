import type { Metadata } from 'next'
import { Inter, Cormorant_Garamond } from 'next/font/google'
import './globals.css'
import { PlayerProvider } from '@/components/player/PlayerContext'
import { AudioPlayer } from '@/components/player/AudioPlayer'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const cormorantGaramond = Cormorant_Garamond({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-cormorant',
})

export const metadata: Metadata = {
  title: "Rabbi Kraz's Shiurim",
  description: 'Timeless Torah wisdom, delivered with passion.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full dark">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className={`${inter.variable} ${cormorantGaramond.variable} font-sans antialiased h-full flex flex-col bg-background text-foreground`}>
        <PlayerProvider>
          <div className="flex-1">
            {children}
          </div>
          <AudioPlayer />
        </PlayerProvider>
      </body>
    </html>
  )
}

