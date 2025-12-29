'use client'

interface PlatformLinksProps {
  links: {
    youtube?: string | null
    youtubeMusic?: string | null
    spotify?: string | null
    apple?: string | null
    amazon?: string | null
    pocket?: string | null
    twentyFourSix?: string | null
    castbox?: string | null
  }
  title: string
}

const platforms = [
  { 
    key: 'youtube', 
    label: 'YouTube', 
    icon: 'fab fa-youtube'
  },
  { 
    key: 'youtubeMusic', 
    label: 'YT Music', 
    icon: 'custom-ytmusic',
    customSvg: (
      <svg viewBox="0 0 176 176" width="1.8rem" height="1.8rem">
        <circle fill="#4a90e2" cx="88" cy="88" r="88"/>
        <path fill="#ffffff" d="M88,46c23.1,0,42,18.8,42,42s-18.8,42-42,42s-42-18.8-42-42S64.9,46,88,46 M88,42
          c-25.4,0-46,20.6-46,46s20.6,46,46,46s46-20.6,46-46S113.4,42,88,42L88,42z"/>
        <polygon fill="#ffffff" points="72,111 111,87 72,65"/>
      </svg>
    )
  },
  { 
    key: 'spotify', 
    label: 'Spotify', 
    icon: 'fab fa-spotify'
  },
  { 
    key: 'apple', 
    label: 'Apple', 
    icon: 'fab fa-apple'
  },
  { 
    key: 'amazon', 
    label: 'Amazon', 
    icon: 'fab fa-amazon'
  },
  { 
    key: 'pocket', 
    label: 'Pocket', 
    icon: 'custom-pocket',
    customSvg: (
      <svg viewBox="0 0 32 32" width="1.8rem" height="1.8rem">
        <circle cx="16" cy="15" r="15" fill="white"/>
        <path fill="#4a90e2" fillRule="evenodd" clipRule="evenodd" d="M16 32c8.837 0 16-7.163 16-16S24.837 0 16 0 0 7.163 0 16s7.163 16 16 16Zm0-28.444C9.127 3.556 3.556 9.127 3.556 16c0 6.873 5.571 12.444 12.444 12.444v-3.11A9.333 9.333 0 1 1 25.333 16h3.111c0-6.874-5.571-12.445-12.444-12.445ZM8.533 16A7.467 7.467 0 0 0 16 23.467v-2.715A4.751 4.751 0 1 1 20.752 16h2.715a7.467 7.467 0 0 0-14.934 0Z"/>
      </svg>
    )
  },
  { 
    key: 'twentyFourSix', 
    label: '24Six', 
    icon: 'fas fa-mobile-alt'
  },
  { 
    key: 'castbox', 
    label: 'Castbox', 
    icon: 'custom-castbox',
    customSvg: (
      <svg width="1.8rem" height="1.8rem" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4a90e2" d="M396,512H116C51.93,512,0,460.07,0,396V116C0,51.93,51.93,0,116,0h280c64.07,0,116,51.93,116,116v280
          C512,460.07,460.07,512,396,512z"/>
        <g>
          <path fill="#ffffff" d="M284.36,172.15c-9.5,0-17.22,7.32-17.22,16.35v39.56c0,5-4.63,9.05-10.33,9.05
            c-5.71,0-10.34-4.05-10.34-9.05v-53.82c0-9.04-7.71-16.36-17.22-16.36c-9.51,0-17.22,7.32-17.22,16.36v43.14
            c0,4.99-4.63,9.05-10.34,9.05c-5.7,0-10.33-4.06-10.33-9.05v-15.63c0-9.03-7.72-16.35-17.22-16.35c-9.51,0-17.22,7.32-17.22,16.35
            v37.01c0,4.99-4.63,9.05-10.34,9.05c-5.7,0-10.33-4.06-10.33-9.05v-4.3c0-9.45-7.71-17.11-17.22-17.11
            c-9.51,0-17.22,7.66-17.22,17.11v51.37c0,9.45,7.7,17.12,17.22,17.12c9.5,0,17.22-7.67,17.22-17.12v-4.3
            c0-4.99,4.63-9.05,10.33-9.05c5.71,0,10.34,4.06,10.34,9.05v58.72c0,9.03,7.7,16.36,17.22,16.36c9.5,0,17.22-7.33,17.22-16.36
            v-80.1c0-4.99,4.63-9.05,10.33-9.05c5.71,0,10.34,4.06,10.34,9.05v40.35c0,9.04,7.7,16.36,17.22,16.36
            c9.5,0,17.22-7.32,17.22-16.36v-29.67c0-4.99,4.63-9.05,10.34-9.05c5.7,0,10.33,4.06,10.33,9.05v31.71
            c0,9.03,7.71,16.35,17.22,16.35c9.51,0,17.22-7.32,17.22-16.35V188.5C301.58,179.47,293.88,172.15,284.36,172.15"/>
          <path fill="#ffffff" d="M339.46,216.33c-9.51,0-17.22,7.32-17.22,16.35v65.13c0,9.03,7.7,16.35,17.22,16.35
            c9.5,0,17.22-7.32,17.22-16.35v-65.13C356.68,223.65,348.97,216.33,339.46,216.33"/>
          <path fill="#ffffff" d="M394.56,249.45c-9.5,0-17.22,7.32-17.22,16.35v16.21c0,9.03,7.71,16.35,17.22,16.35
            c9.51,0,17.22-7.32,17.22-16.35V265.8C411.78,256.77,404.08,249.45,394.56,249.45"/>
        </g>
      </svg>
    )
  },
]

export default function PlatformLinks({ links, title }: PlatformLinksProps) {
  const availablePlatforms = platforms.filter(
    (platform) => links[platform.key as keyof typeof links]
  )

  if (availablePlatforms.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-4 md:gap-6 justify-center items-center">
      {availablePlatforms.map((platform) => {
        const url = links[platform.key as keyof typeof links]
        if (!url) return null

        return (
          <a
            key={platform.key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center text-decoration-none text-gray-700 hover:text-primary transition-all hover:-translate-y-1"
          >
            {platform.customSvg ? (
              <div className="mb-2">{platform.customSvg}</div>
            ) : (
              <i className={`${platform.icon} text-3xl md:text-4xl text-[#4a90e2] mb-2`}></i>
            )}
            <span className="text-sm md:text-base">{platform.label}</span>
          </a>
        )
      })}
    </div>
  )
}

