'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react'

// Define source types based on what we're actually storing
interface ExtractedSource {
    id: string
    name: string
    image?: string
    text?: string
    reference?: string
    // Positioning data
    box?: {
        x: number
        y: number
        width: number
        height: number
        page?: number
    }
    // New fields
    displaySize?: number // Percentage width (10-100)
    rotation?: number // Degrees (0, 90, 180, 270)
}

interface SourceSheetViewerProps {
    sourceDoc?: string | null
    sourcesJson?: string | null
    title?: string
}

export default function SourceSheetViewer({ sourceDoc, sourcesJson, title }: SourceSheetViewerProps) {
    const [allSources, setAllSources] = useState<ExtractedSource[]>([])
    const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())
    const [showPdf, setShowPdf] = useState(false)
    const [embedUrl, setEmbedUrl] = useState<string | null>(null)

    // Lightbox State
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [isZoomed, setIsZoomed] = useState(false)

    const hasPdfUrl = !!sourceDoc
    const hasAnySources = allSources.length > 0

    // Load sources from JSON
    useEffect(() => {
        if (sourcesJson) {
            try {
                let parsed = typeof sourcesJson === 'string' ? JSON.parse(sourcesJson) : sourcesJson
                if (typeof parsed === 'string') parsed = JSON.parse(parsed)

                if (Array.isArray(parsed)) {
                    setAllSources(parsed)
                    setExpandedSources(new Set()) // Collapsed by default
                }
            } catch (e) {
                console.error('Failed to parse sources JSON', e)
            }
        }
    }, [sourcesJson])

    // Prepare PDF URL
    useEffect(() => {
        if (sourceDoc) {
            let url = sourceDoc
            if (url.includes('dropbox.com')) {
                url = url.replace('?dl=0', '').replace('?dl=1', '') + '?raw=1'
            } else if (url.includes('drive.google.com') && url.includes('/view')) {
                url = url.replace('/view', '/preview')
            }
            setEmbedUrl(url)
        }
    }, [sourceDoc])

    // View Mode Logic: Default to Clipped if available
    useEffect(() => {
        if (!hasAnySources && hasPdfUrl) {
            setShowPdf(true)
        } else if (hasAnySources) {
            setShowPdf(false)
        }
    }, [hasAnySources, hasPdfUrl])

    const toggleSource = (id: string) => {
        const newExpanded = new Set(expandedSources)
        if (newExpanded.has(id)) {
            newExpanded.delete(id)
        } else {
            newExpanded.add(id)
        }
        setExpandedSources(newExpanded)
    }

    const expandAll = () => {
        setExpandedSources(new Set(allSources.map(s => s.id)))
    }

    const collapseAll = () => {
        setExpandedSources(new Set())
    }



    if (!hasAnySources && !hasPdfUrl) return null

    return (
        <>
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                {/* Unified Header */}
                <div className="bg-white px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📜</span>
                        <div>
                            <h2 className="text-lg font-serif font-semibold text-primary">Source Sheet</h2>
                            {hasAnySources && !showPdf && (
                                <p className="text-muted-foreground text-xs">{allSources.length} sources</p>
                            )}
                        </div>
                    </div>

                    {/* Controls Area */}
                    <div className="flex items-center gap-4 self-end md:self-auto flex-wrap justify-end">

                        {/* Expand/Collapse Toggle */}
                        {!showPdf && hasAnySources && (
                            <button
                                onClick={() => {
                                    if (expandedSources.size > 0) {
                                        collapseAll()
                                    } else {
                                        expandAll()
                                    }
                                }}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 white-space-nowrap"
                            >
                                {expandedSources.size > 0 ? (
                                    <>
                                        <ChevronUp size={14} />
                                        <span className="hidden sm:inline">Collapse All</span>
                                        <span className="sm:hidden">Collapse</span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={14} />
                                        <span className="hidden sm:inline">Expand All</span>
                                        <span className="sm:hidden">Expand</span>
                                    </>
                                )}
                            </button>
                        )}

                        {/* View Toggle */}
                        {hasAnySources && hasPdfUrl && (
                            <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setShowPdf(false)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!showPdf
                                        ? 'bg-white text-primary shadow-sm border border-gray-200'
                                        : 'text-gray-500 hover:text-gray-900'
                                        }`}
                                >
                                    Clipped
                                </button>
                                <button
                                    onClick={() => setShowPdf(true)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${showPdf
                                        ? 'bg-white text-primary shadow-sm border border-gray-200'
                                        : 'text-gray-500 hover:text-gray-900'
                                        }`}
                                >
                                    PDF
                                </button>
                            </div>
                        )}

                        {/* External Link */}
                        {hasPdfUrl && (
                            <a
                                href={sourceDoc!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-gray-100 p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Open Original PDF in New Tab"
                            >
                                <ExternalLink size={18} />
                            </a>
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
                                                    className="relative rounded-lg overflow-hidden shadow-sm border border-slate-200 w-full md:w-[var(--desktop-width)] group/image cursor-zoom-in"
                                                    style={{ '--desktop-width': `${displayWidth}%` } as React.CSSProperties}
                                                    onClick={() => {
                                                        setPreviewImage(source.image || null)
                                                        setIsZoomed(false)
                                                    }}
                                                >
                                                    <img
                                                        src={source.image}
                                                        alt={source.name}
                                                        className="w-full block bg-slate-50"
                                                        style={{
                                                            transform: source.rotation ? `rotate(${source.rotation}deg)` : undefined,
                                                            transformOrigin: 'center'
                                                        }}
                                                        loading="lazy"
                                                    />

                                                    {/* Hover Overlay for Zoom Hint - Top Right Corner, No Blur */}
                                                    <div className="absolute top-3 right-3 opacity-0 group-hover/image:opacity-100 transition-opacity duration-200 pointer-events-none">
                                                        <div className="bg-black/50 backdrop-blur-md text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium shadow-sm">
                                                            <Maximize2 size={14} />
                                                            Expand
                                                        </div>
                                                    </div>
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
                        </div>
                    )}
                </div>
            </div>

            {/* LIGHTBOX OVERLAY */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200 cursor-default"
                    onClick={() => setPreviewImage(null)} // Clicking ANYWHERE on the background closes it
                >
                    {/* Toolbar */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 pointer-events-none">
                        <span className="text-white/70 text-sm font-medium px-4">Preview</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setPreviewImage(null)
                            }}
                            className="pointer-events-auto bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5 transition-colors backdrop-blur-md"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Image Container */}
                    <div
                        className={`flex-1 flex w-full h-full overflow-hidden ${isZoomed ? 'overflow-auto cursor-default' : 'items-center justify-center'}`}
                    // Container click just bubbles up to Overlay close (no stopPropagation here)
                    >
                        <img
                            src={previewImage}
                            alt="Source Preview"
                            className={`transition-all duration-300 shadow-2xl ${isZoomed ? 'min-w-full min-h-full object-none cursor-zoom-out' : 'max-w-full max-h-screen object-contain p-4 cursor-zoom-in'}`}
                            onClick={(e) => {
                                e.stopPropagation() // Don't close when clicking image
                                setIsZoomed(!isZoomed) // Toggle Zoom instead
                            }}
                        />
                    </div>

                    {/* Footer Controls */}
                    <div
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsZoomed(!isZoomed)}
                            className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2.5 rounded-full flex items-center gap-2 text-sm font-medium shadow-xl transition-all border border-white/10"
                        >
                            {isZoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
                            {isZoomed ? 'Fit to Screen' : 'Zoom In'}
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
