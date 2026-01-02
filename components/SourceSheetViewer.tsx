'use client'

import { ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'

interface SourceSheetViewerProps {
  sourceDoc: string
  title: string
}

interface SourceData {
  id: string
  name: string
  image: string | null
  rotation: number
  reference: string | null
  displaySize?: number
}

// Convert Google Drive/Docs URL to embeddable format
function convertToEmbedUrl(url: string): string {
  if (!url) return url

  if (url.includes('/preview') || url.includes('embedded=true')) {
    return url
  }

  const driveMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1]
    if (url.includes('docs.google.com/document')) {
      return `https://docs.google.com/document/d/${fileId}/pub?embedded=true`
    }
    return `https://drive.google.com/file/d/${fileId}/preview`
  }

  return url
}

function CollapsibleSource({ source, index }: { source: SourceData; index: number }) {
  const [isOpen, setIsOpen] = useState(false) // Collapsed by default

  return (
    <article
      className={`group bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${isOpen ? 'border-slate-200 shadow-md ring-1 ring-blue-100' : 'border-slate-100 shadow-sm hover:border-blue-200'
        }`}
    >
      {/* Source Header - Clickable to toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-slate-50 to-transparent border-b border-transparent cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div className={`flex-shrink-0 w-10 h-10 transition-colors duration-300 rounded-xl flex items-center justify-center shadow-sm font-bold ${isOpen ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700'
          }`}>
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold truncate text-lg transition-colors ${isOpen ? 'text-blue-700' : 'text-slate-700'}`}>
            {source.name}
          </h3>
          {source.reference && (
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              {source.reference}
            </p>
          )}
        </div>

        <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Source Image - Collapsible content */}
      <div
        className={`bg-slate-50 border-t border-slate-100 transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
          }`}
      >
        {source.image && (
          <div className="p-4 md:p-8 flex justify-center">
            <div
              className="relative bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden transition-all duration-500"
              style={{ width: `${source.displaySize || 75}%` }}
            >
              <img
                src={source.image}
                alt={source.name}
                className="w-full block"
                style={{
                  transform: source.rotation ? `rotate(${source.rotation}deg)` : undefined,
                  transformOrigin: 'center'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

export default function SourceSheetViewer({ sourceDoc, title }: SourceSheetViewerProps) {
  const isSourcesJson = sourceDoc?.startsWith('sources:')
  const [showOriginal, setShowOriginal] = useState(false)

  const parsedData = useMemo(() => {
    if (!isSourcesJson) return { sources: [], originalUrl: null }
    try {
      const json = JSON.parse(sourceDoc.slice(8))
      if (Array.isArray(json)) {
        return { sources: json as SourceData[], originalUrl: null }
      } else {
        return { sources: json.sources as SourceData[], originalUrl: json.originalUrl || null }
      }
    } catch {
      return { sources: [], originalUrl: null }
    }
  }, [sourceDoc, isSourcesJson])

  const { sources, originalUrl } = parsedData

  // If it's NOT json, it's just a raw URL
  const legacyUrl = useMemo(() => {
    if (isSourcesJson) return null
    return convertToEmbedUrl(sourceDoc)
  }, [sourceDoc, isSourcesJson])

  if (!sourceDoc) return null

  // ============================================================================
  // VIEW MODE: Original PDF (if toggled or if legacy URL)
  // ============================================================================
  if (legacyUrl || (showOriginal && originalUrl)) {
    const urlToEmbed = legacyUrl || convertToEmbedUrl(originalUrl)
    return (
      <div className="space-y-4">
        {/* Toggle Button (only if we have both modes) */}
        {isSourcesJson && originalUrl && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowOriginal(false)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg shadow-sm hover:bg-blue-50 transition-colors text-sm font-medium"
            >
              <span>✨ View Clipped Sources</span>
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 md:p-6 lg:p-10">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="font-serif text-xl md:text-2xl font-semibold text-primary">
                Source Sheet {showOriginal ? '(Original PDF)' : ''}
              </h2>
              <a
                href={urlToEmbed}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Open in new tab <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="relative w-full aspect-[4/5] bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
              <iframe
                src={urlToEmbed}
                className="absolute inset-0 w-full h-full"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================================
  // VIEW MODE: Clipped Sources
  // ============================================================================
  if (isSourcesJson && sources.length > 0) {
    return (
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-3xl shadow-lg border border-slate-200/60 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-6 py-5 md:px-8 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                📜 Source Sheet
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                {sources.length} source{sources.length !== 1 ? 's' : ''} • {title}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Toggle to Original PDF */}
              {originalUrl && (
                <button
                  onClick={() => setShowOriginal(true)}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <span>📄 View Original PDF</span>
                </button>
              )}

              <div className="hidden md:flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                <span className="text-white/80 text-sm">Scroll to explore</span>
                <span className="text-white animate-bounce">↓</span>
              </div>
            </div>
          </div>
        </div>
        {/* Sources List */}
        <div className="p-4 md:p-6 lg:p-8 space-y-4">
          {sources.map((source, idx) => (
            <CollapsibleSource key={source.id} source={source} index={idx} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Click on a source header to expand/collapse
          </p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // LEGACY: Render embedded iframe for URL-based sources
  // ============================================================================
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 md:p-6 lg:p-10">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="font-serif text-xl md:text-2xl font-semibold text-primary">
            Source Sheet
          </h2>
          <a
            href={sourceDoc}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-2 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Open in new tab</span>
            <span className="sm:hidden">Open</span>
          </a>
        </div>

        <div
          className="w-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
          style={{
            minHeight: '600px',
            height: 'calc(100vh - 300px)',
            maxHeight: '1200px'
          }}
        >
          <iframe
            src={legacyUrl ?? ''}
            className="w-full h-full border-0"
            title={`Source Sheet: ${title}`}
            allowFullScreen
            loading="lazy"
            style={{
              minHeight: '600px',
              display: 'block'
            }}
          />
        </div>
      </div>
    </div>
  )
}
