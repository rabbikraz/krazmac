'use client'

import { ExternalLink, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { useMemo, useState } from 'react'

interface SourceSheetViewerProps {
    sourceDoc?: string | null  // PDF URL
    sourcesJson?: string | null  // Clipped sources JSON
    title: string
}

interface SourceData {
    id: string
    name: string
    image: string | null
    rotation: number
    reference: string | null
    displaySize?: number  // Percentage 25-100
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

export default function SourceSheetViewer({ sourceDoc, sourcesJson, title }: SourceSheetViewerProps) {
    const [showPdf, setShowPdf] = useState(false)
    const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())

    // Parse clipped sources
    const sources: SourceData[] = useMemo(() => {
        if (!sourcesJson) return []
        try {
            return JSON.parse(sourcesJson)
        } catch {
            return []
        }
    }, [sourcesJson])

    const hasClippedSources = sources.length > 0
    const hasPdfUrl = Boolean(sourceDoc && !sourceDoc.startsWith('sources:'))

    // Legacy support: check if sourceDoc contains old format
    const legacySources: SourceData[] = useMemo(() => {
        if (sourceDoc?.startsWith('sources:')) {
            try {
                return JSON.parse(sourceDoc.slice(8))
            } catch {
                return []
            }
        }
        return []
    }, [sourceDoc])

    const allSources = hasClippedSources ? sources : legacySources
    const hasAnySources = allSources.length > 0

    const embedUrl = useMemo(() => {
        if (!hasPdfUrl || !sourceDoc) return null
        return convertToEmbedUrl(sourceDoc)
    }, [sourceDoc, hasPdfUrl])

    const toggleSource = (id: string) => {
        setExpandedSources(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const expandAll = () => {
        setExpandedSources(new Set(allSources.map(s => s.id)))
    }

    const collapseAll = () => {
        setExpandedSources(new Set())
    }

    if (!hasAnySources && !hasPdfUrl) return null

    // ============================================================================
    // MAIN VIEW: Show clipped sources by default, with PDF toggle
    // ============================================================================
    if (hasAnySources && !showPdf) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">📜</span>
                            <div>
                                <h2 className="text-lg font-bold text-white">Source Sheet</h2>
                                <p className="text-slate-300 text-xs">{allSources.length} sources</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={expandAll}
                                className="text-xs text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                            >
                                Expand All
                            </button>
                            <button
                                onClick={collapseAll}
                                className="text-xs text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                            >
                                Collapse All
                            </button>
                            {hasPdfUrl && (
                                <button
                                    onClick={() => setShowPdf(true)}
                                    className="flex items-center gap-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-full transition-colors"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    View PDF
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sources - Collapsible */}
                <div className="divide-y divide-slate-100">
                    {allSources.map((source, idx) => {
                        const isExpanded = expandedSources.has(source.id)
                        const displayWidth = source.displaySize || 75

                        return (
                            <div key={source.id} className="bg-white">
                                {/* Collapsible Header */}
                                <button
                                    onClick={() => toggleSource(source.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                                >
                                    <span className="w-7 h-7 bg-slate-700 text-white text-sm font-bold rounded-lg flex items-center justify-center flex-shrink-0">
                                        {idx + 1}
                                    </span>
                                    <span className="flex-1 font-medium text-slate-800 truncate">{source.name}</span>
                                    {source.reference && (
                                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded hidden sm:block">
                                            {source.reference}
                                        </span>
                                    )}
                                    {isExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                </button>

                                {/* Expandable Content */}
                                {isExpanded && source.image && (
                                    <div className="px-4 pb-4">
                                        <div
                                            className="mx-auto bg-slate-50 rounded-lg border border-slate-200 overflow-hidden"
                                            style={{ maxWidth: `${displayWidth}%` }}
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
                        )
                    })}
                </div>
            </div>
        )
    }

    // ============================================================================
    // PDF VIEW: Show embedded PDF with button to go back to sources
    // ============================================================================
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 md:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif text-xl md:text-2xl font-semibold text-primary flex items-center gap-2">
                        <FileText className="w-6 h-6" />
                        PDF Source Sheet
                    </h2>
                    <div className="flex items-center gap-2">
                        {hasAnySources && (
                            <button
                                onClick={() => setShowPdf(false)}
                                className="flex items-center gap-1.5 text-sm bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                                📜 View Clipped Sources
                            </button>
                        )}
                        <a
                            href={sourceDoc!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-2"
                        >
                            <ExternalLink className="w-4 h-4" />
                            <span className="hidden sm:inline">Open</span>
                        </a>
                    </div>
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
                        src={embedUrl ?? ''}
                        className="w-full h-full border-0"
                        title={`Source Sheet: ${title}`}
                        allowFullScreen
                        loading="lazy"
                        style={{ minHeight: '600px', display: 'block' }}
                    />
                </div>
            </div>
        </div>
    )
}
