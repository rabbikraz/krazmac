'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Maximize2, X, ZoomIn, ZoomOut, RefreshCcw } from 'lucide-react'

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
    const [previewSource, setPreviewSource] = useState<ExtractedSource | null>(null)

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
                                            <div className="px-5 pb-6 pt-0 ml-10 mb-4">
                                                <div
                                                    className="relative rounded-lg overflow-hidden shadow-sm border border-slate-200 w-full md:w-[var(--desktop-width)] group/image cursor-zoom-in"
                                                    style={{ '--desktop-width': `${displayWidth}%` } as React.CSSProperties}
                                                    onClick={() => {
                                                        setPreviewSource(source)
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

                                                    {/* Hover Overlay for Zoom Hint - Top Right Corner*/}
                                                    <div className="absolute top-3 right-3 opacity-0 group-hover/image:opacity-100 transition-opacity duration-200 pointer-events-none">
                                                        <div className="bg-black/50 backdrop-blur-md text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium shadow-sm">
                                                            <Maximize2 size={14} />
                                                            Expand
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* View on Sefaria Link */}
                                                {source.reference && (
                                                    <a
                                                        href={`https://www.sefaria.org/${source.reference.replace(/ /g, '_')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 mt-3 text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
                                                    >
                                                        <ExternalLink size={14} />
                                                        View on Sefaria
                                                    </a>
                                                )}
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
            {previewSource && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
                // We REMOVE the onClick here, because we handle it inside ZoomPanContainer carefully
                // to differentiate pan vs click
                >
                    {/* Toolbar */}
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 pointer-events-none">
                        <span className="text-white/90 text-sm font-semibold px-4 drop-shadow-md truncate max-w-[80%]">
                            {previewSource.name}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setPreviewSource(null)
                            }}
                            className="pointer-events-auto bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5 transition-colors backdrop-blur-md cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Zoom/Pan Container */}
                    <div className="absolute inset-0 z-0">
                        <ZoomPanContainer
                            src={previewSource.image!}
                            alt={previewSource.name}
                            onClose={() => setPreviewSource(null)}
                        />
                    </div>
                </div>
            )}
        </>
    )
}

// ----------------------------------------------------------------------------
// Internal Helper Component for Robust Zoom/Pan
// ----------------------------------------------------------------------------

function ZoomPanContainer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
    const [isDragging, setIsDragging] = useState(false)
    const [hasMoved, setHasMoved] = useState(false) // Track if drag actually happened

    const lastMouse = useRef({ x: 0, y: 0 })

    // Pinch State
    const lastTouchDistance = useRef<number | null>(null)
    const lastTouchCenter = useRef<{ x: number, y: number } | null>(null)

    // Reset on mount
    useEffect(() => {
        setTransform({ x: 0, y: 0, scale: 1 })
    }, [src])

    const updateTransform = (x: number, y: number, scale: number) => {
        const newScale = Math.min(Math.max(0.5, scale), 8)
        setTransform({ x, y, scale: newScale })
    }

    // --- MOUSE WHEEL ZOOM ---
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        e.stopPropagation()

        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return

        const delta = -e.deltaY
        const factor = delta > 0 ? 1.1 : 0.9

        const newScale = Math.min(Math.max(0.5, transform.scale * factor), 8)

        const containerCenterX = rect.width / 2
        const containerCenterY = rect.height / 2

        const offsetX = e.clientX - rect.left - containerCenterX
        const offsetY = e.clientY - rect.top - containerCenterY

        const newX = offsetX - (offsetX - transform.x) * (newScale / transform.scale)
        const newY = offsetY - (offsetY - transform.y) * (newScale / transform.scale)

        updateTransform(newX, newY, newScale)
    }

    // --- PANNING (MOUSE) ---
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
        setHasMoved(false) // Reset move tracker
        lastMouse.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return
        e.preventDefault()
        e.stopPropagation()

        const dx = e.clientX - lastMouse.current.x
        const dy = e.clientY - lastMouse.current.y

        // Threshold check to avoid registering micro-motions as drags when clicking
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            setHasMoved(true)
        }

        lastMouse.current = { x: e.clientX, y: e.clientY }
        updateTransform(transform.x + dx, transform.y + dy, transform.scale)
    }

    const handleMouseUp = (e: React.MouseEvent) => {
        setIsDragging(false)
        // Note: Logic for "was it a click?" is handled in onClick, which fires after MouseUp.
        // But if we preventDefault in down/move, onClick might not fire?
        // Actually, if we preventDefault on DOWN, native focus/click might be suppressed.
        // Let's rely on standard React onClick behavior.
    }

    // --- CLICK HANDLER (SMART CLOSE) ---
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()

        // If we dragged (panned) significantly, ignore this "click"
        if (hasMoved) return

        // If we touched the Image, do NOT close (maybe toggle zoom?)
        // We removed pointer-events-none from image so it is a valid target.
        if (e.target instanceof HTMLImageElement) {
            // Optional: Click image to toggle zoom?
            // Users requested "click black part to collapse".
            // So click image = do nothing (or zoom).
            return
        }

        // If we clicked the background (Container)
        onClose()
    }

    // --- PINCH ZOOM (TOUCH) ---
    const getDistance = (t1: React.Touch, t2: React.Touch) => {
        const dx = t1.clientX - t2.clientX
        const dy = t1.clientY - t2.clientY
        return Math.sqrt(dx * dx + dy * dy)
    }

    const getCenter = (t1: React.Touch, t2: React.Touch) => {
        return {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        }
    }

    const handleTouchStart = (e: React.TouchEvent) => {
        e.stopPropagation()
        setHasMoved(false)

        if (e.touches.length === 2) {
            lastTouchDistance.current = getDistance(e.touches[0], e.touches[1])
        } else if (e.touches.length === 1) {
            lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
            setIsDragging(true)
        }
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        e.stopPropagation()
        setHasMoved(true)

        if (e.touches.length === 2 && lastTouchDistance.current) {
            const newDist = getDistance(e.touches[0], e.touches[1])
            const scaleFactor = newDist / lastTouchDistance.current

            const newScale = Math.min(Math.max(0.5, transform.scale * scaleFactor), 8)

            const rect = containerRef.current?.getBoundingClientRect()
            if (rect) {
                const c = getCenter(e.touches[0], e.touches[1])
                const offsetX = c.x - rect.left - rect.width / 2
                const offsetY = c.y - rect.top - rect.height / 2

                const newX = offsetX - (offsetX - transform.x) * (newScale / transform.scale)
                const newY = offsetY - (offsetY - transform.y) * (newScale / transform.scale)

                updateTransform(newX, newY, newScale)
            } else {
                updateTransform(transform.x, transform.y, newScale)
            }

            lastTouchDistance.current = newDist
        } else if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - lastMouse.current.x
            const dy = e.touches[0].clientY - lastMouse.current.y
            lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
            updateTransform(transform.x + dx, transform.y + dy, transform.scale)
        }
    }

    const handleTouchEnd = () => {
        setIsDragging(false)
        lastTouchDistance.current = null
        lastTouchCenter.current = null
    }

    // Toggle zoom on click (Fit / 100%)
    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (transform.scale > 1.1) {
            // Reset
            setTransform({ x: 0, y: 0, scale: 1 })
        } else {
            // Zoom to 2.5x
            setTransform({ x: 0, y: 0, scale: 2.5 })
        }
    }

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-hidden touch-none relative flex items-center justify-center cursor-grab active:cursor-grabbing"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            // We use standard onClick for the "Close" logic to separate Drag from Click
            onClick={handleClick}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDoubleClick}
        >
            <img
                src={src}
                alt={alt}
                draggable={false}
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    transformOrigin: 'center',
                    transition: isDragging || lastTouchDistance.current ? 'none' : 'transform 0.1s ease-out',
                    willChange: 'transform'
                }}
                className="max-w-[95vw] max-h-[90vh] object-contain shadow-2xl block touch-none select-none"
            // Removed pointer-events-none so we can detect clicks on image vs background
            />

            {/* Controls Overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 pointer-events-auto">
                <button
                    onClick={(e) => {
                        e.stopPropagation() // Don't trigger close
                        if (transform.scale > 1.1) setTransform({ x: 0, y: 0, scale: 1 })
                        else setTransform({ x: 0, y: 0, scale: 2.5 })
                    }}
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2.5 rounded-full flex items-center gap-2 text-sm font-medium shadow-xl transition-all border border-white/10"
                >
                    {transform.scale > 1.1 ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
                    {transform.scale > 1.1 ? 'Reset' : 'Zoom In'}
                </button>
            </div>
        </div>
    )
}
