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
    // MAIN VIEW: Unified Container with Toggle
    // ============================================================================
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Unified Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">📜</span>
                    <div>
                        <h2 className="text-lg font-bold text-white">Source Sheet</h2>
                        {hasAnySources && !showPdf && (
                            <p className="text-slate-300 text-xs">{allSources.length} sources</p>
                        )}
                    </div>
                </div>

                {/* Controls Area */}
                <div className="flex items-center gap-4 self-end md:self-auto">

                    {/* Expand/Collapse Toggle (Only in Clipped View) */}
                    {!showPdf && hasAnySources && (
                        <button
                            onClick={() => {
                                if (expandedSources.size > 0) {
                                    collapseAll()
                                } else {
                                    expandAll()
                                }
                            }}
                            className="bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            {expandedSources.size > 0 ? (
                                <>
                                    <ChevronUp size={14} />
                                    Collapse All
                                </>
                            ) : (
                                <>
                                    <ChevronDown size={14} />
                                    Expand All
                                </>
                            )}
                        </button>
                    )}

                    {/* View Toggle (Only if both formats exist) */}
                    {hasAnySources && hasPdfUrl && (
                        <div className="flex items-center bg-slate-900/50 p-1 rounded-lg">
                            <button
                                onClick={() => setShowPdf(false)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!showPdf
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                Clipped
                            </button>
                            <button
                                onClick={() => setShowPdf(true)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${showPdf
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                PDF
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div>
                {/* MODE: CLIPPED SOURCES */}
                {(!showPdf || !hasPdfUrl) && hasAnySources && (
                    <div className="divide-y divide-slate-100">
                        {allSources.map((source, idx) => {
                            const isExpanded = expandedSources.has(source.id)
                            const displayWidth = source.displaySize || 75

                            return (
                                <div key={source.id} className="bg-white group">
                                    {/* Collapsible Header */}
                                    <button
                                        onClick={() => toggleSource(source.id)}
                                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <span className="w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-500 text-xs font-bold rounded-full group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors flex-shrink-0">
                                            {idx + 1}
                                        </span>
                                        <span className="flex-1 font-medium text-slate-800">{source.name}</span>
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
                                        <div className="px-5 pb-6 pt-0 ml-10 border-l-2 border-slate-100 mb-4">
                                            <div
                                                className="relative rounded-lg overflow-hidden shadow-sm border border-slate-200 transition-all duration-300"
                                                style={{ width: `${displayWidth}%` }}
                                            >
                                                <img
                                                    src={source.image}
                                                    alt={source.name}
                                                    className="w-full block bg-slate-50"
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
                )}

                {/* MODE: PDF VIEWER */}
                {(showPdf || (!hasAnySources && hasPdfUrl)) && embedUrl && (
                    <div className="relative bg-slate-100">
                        <iframe
                            src={embedUrl ?? ''}
                            className="w-full h-[800px] border-0"
                            title={`Source Sheet: ${title}`}
                            allowFullScreen
                            loading="lazy"
                        />
                        {/* External Link Overlay */}
                        <div className="absolute top-4 right-4 print:hidden">
                            <a
                                href={sourceDoc!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur text-xs font-medium text-slate-700 rounded-lg shadow-sm border border-slate-200 hover:text-blue-600 hover:bg-white transition-all"
                            >
                                <ExternalLink size={12} />
                                Open External
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
