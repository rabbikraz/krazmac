'use client'

import { useState, useRef, useCallback } from 'react'

// ============================================================================
// TYPES
// ============================================================================

interface Source {
    id: string
    pageIndex: number
    box: { x: number; y: number; width: number; height: number }
    text: string
    reference: string | null
    sefariaUrl: string | null
    sefariaText: string | null
}

interface PageData {
    imageDataUrl: string
    width: number
    height: number
}

type AppState = 'upload' | 'processing' | 'editing' | 'preview'

// ============================================================================
// PDF TO IMAGES UTILITY
// ============================================================================

async function convertPdfToImages(file: File): Promise<PageData[]> {
    const pdfjs = await import('pdfjs-dist')
    const pdfjsLib = pdfjs.default || pdfjs

    // Set worker path
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pages: PageData[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const scale = 2 // High quality
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height

        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport } as any).promise

        pages.push({
            imageDataUrl: canvas.toDataURL('image/png'),
            width: viewport.width,
            height: viewport.height
        })
    }

    return pages
}

async function convertImageToDataUrl(file: File): Promise<PageData> {
    return new Promise((resolve) => {
        const reader = new FileReader()
        const img = new Image()

        reader.onload = () => {
            img.onload = () => {
                resolve({
                    imageDataUrl: reader.result as string,
                    width: img.width,
                    height: img.height
                })
            }
            img.src = reader.result as string
        }
        reader.readAsDataURL(file)
    })
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SourceManager() {
    // State
    const [appState, setAppState] = useState<AppState>('upload')
    const [pages, setPages] = useState<PageData[]>([])
    const [sources, setSources] = useState<Source[]>([])
    const [currentPageIndex, setCurrentPageIndex] = useState(0)
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState('')
    const [error, setError] = useState<string | null>(null)

    // Drawing state
    const [isDrawing, setIsDrawing] = useState(false)
    const [drawStart, setDrawStart] = useState<{ x: number, y: number } | null>(null)
    const [drawEnd, setDrawEnd] = useState<{ x: number, y: number } | null>(null)

    const canvasRef = useRef<HTMLDivElement>(null)

    // ============================================================================
    // FILE HANDLING
    // ============================================================================

    const handleFileUpload = async (file: File) => {
        setError(null)
        setAppState('processing')
        setStatusMessage('Loading file...')

        try {
            let pageData: PageData[]

            if (file.type === 'application/pdf') {
                setStatusMessage('Converting PDF pages to images...')
                pageData = await convertPdfToImages(file)
            } else {
                setStatusMessage('Loading image...')
                pageData = [await convertImageToDataUrl(file)]
            }

            setPages(pageData)
            setStatusMessage(`Loaded ${pageData.length} page(s). Analyzing with AI...`)

            // Analyze each page
            const allSources: Source[] = []

            for (let i = 0; i < pageData.length; i++) {
                setStatusMessage(`Analyzing page ${i + 1} of ${pageData.length}...`)
                const pageSources = await analyzePageWithGemini(pageData[i], i)
                allSources.push(...pageSources)
            }

            if (allSources.length === 0) {
                setStatusMessage('No sources detected. Draw boxes manually.')
            } else {
                setStatusMessage(`Found ${allSources.length} sources. Looking up in Sefaria...`)

                // Enrich with Sefaria data
                for (const source of allSources) {
                    if (source.reference) {
                        await enrichWithSefaria(source)
                    }
                }

                setStatusMessage(`Done! Found ${allSources.length} sources.`)
            }

            setSources(allSources)
            setCurrentPageIndex(0)
            setAppState('editing')

        } catch (err) {
            console.error('Error processing file:', err)
            setError(String(err))
            setAppState('upload')
        }
    }

    // ============================================================================
    // AI ANALYSIS
    // ============================================================================

    const analyzePageWithGemini = async (page: PageData, pageIndex: number): Promise<Source[]> => {
        try {
            // Convert data URL to blob
            const response = await fetch(page.imageDataUrl)
            const blob = await response.blob()
            const file = new File([blob], 'page.png', { type: 'image/png' })

            const formData = new FormData()
            formData.append('image', file)

            const res = await fetch('/api/sources/analyze', {
                method: 'POST',
                body: formData
            })

            const data = await res.json() as {
                success: boolean
                sources?: Array<{
                    id?: string
                    box: { x: number; y: number; width: number; height: number }
                    text?: string
                    reference?: string | null
                }>
            }

            if (data.success && data.sources && data.sources.length > 0) {
                return data.sources.map((s) => ({
                    id: s.id || `source-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    pageIndex,
                    box: s.box,
                    text: s.text || '',
                    reference: s.reference || null,
                    sefariaUrl: null,
                    sefariaText: null
                }))
            }

            return []
        } catch (err) {
            console.error('Gemini analysis failed:', err)
            return []
        }
    }

    const enrichWithSefaria = async (source: Source) => {
        if (!source.reference) return

        try {
            const res = await fetch(`/api/sources/sefaria?ref=${encodeURIComponent(source.reference)}`)
            const data = await res.json() as {
                found: boolean
                url?: string
                he?: string
                text?: string
            }

            if (data.found) {
                source.sefariaUrl = data.url || null
                source.sefariaText = data.he || data.text || null
            }
        } catch (err) {
            console.error('Sefaria lookup failed:', err)
        }
    }

    // ============================================================================
    // DRAWING
    // ============================================================================

    const getRelativePosition = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        return {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100
        }
    }

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (appState !== 'editing') return
        const pos = getRelativePosition(e)
        setIsDrawing(true)
        setDrawStart(pos)
        setDrawEnd(pos)
        setSelectedSourceId(null)
    }

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDrawing) return
        setDrawEnd(getRelativePosition(e))
    }

    const handleMouseUp = () => {
        if (!isDrawing || !drawStart || !drawEnd) {
            setIsDrawing(false)
            return
        }

        const x = Math.min(drawStart.x, drawEnd.x)
        const y = Math.min(drawStart.y, drawEnd.y)
        const width = Math.abs(drawEnd.x - drawStart.x)
        const height = Math.abs(drawEnd.y - drawStart.y)

        // Only add if box is large enough
        if (width > 3 && height > 3) {
            const newSource: Source = {
                id: `manual-${Date.now()}`,
                pageIndex: currentPageIndex,
                box: { x, y, width, height },
                text: '',
                reference: null,
                sefariaUrl: null,
                sefariaText: null
            }
            setSources(prev => [...prev, newSource])
            setSelectedSourceId(newSource.id)
        }

        setIsDrawing(false)
        setDrawStart(null)
        setDrawEnd(null)
    }

    // ============================================================================
    // SOURCE MANAGEMENT
    // ============================================================================

    const deleteSource = (id: string) => {
        setSources(prev => prev.filter(s => s.id !== id))
        if (selectedSourceId === id) setSelectedSourceId(null)
    }

    const updateSourceReference = (id: string, reference: string) => {
        setSources(prev => prev.map(s =>
            s.id === id ? { ...s, reference } : s
        ))
    }

    const lookupSource = async (source: Source) => {
        if (!source.reference) return
        setStatusMessage(`Looking up "${source.reference}"...`)
        await enrichWithSefaria(source)
        setSources([...sources]) // Trigger re-render
        setStatusMessage('')
    }

    // Quick grid
    const applyQuickGrid = (rows: number) => {
        const newSources: Source[] = []
        const rowHeight = 90 / rows

        for (let i = 0; i < rows; i++) {
            newSources.push({
                id: `grid-${currentPageIndex}-${i}`,
                pageIndex: currentPageIndex,
                box: { x: 5, y: 5 + (i * rowHeight), width: 90, height: rowHeight },
                text: '',
                reference: null,
                sefariaUrl: null,
                sefariaText: null
            })
        }

        // Replace sources for current page only
        setSources(prev => [
            ...prev.filter(s => s.pageIndex !== currentPageIndex),
            ...newSources
        ])
    }

    const clearCurrentPage = () => {
        setSources(prev => prev.filter(s => s.pageIndex !== currentPageIndex))
        setSelectedSourceId(null)
    }

    const reanalyzeCurrentPage = async () => {
        if (!pages[currentPageIndex]) return

        setStatusMessage('Re-analyzing page with AI...')
        const newSources = await analyzePageWithGemini(pages[currentPageIndex], currentPageIndex)

        // Enrich with Sefaria
        for (const source of newSources) {
            if (source.reference) {
                await enrichWithSefaria(source)
            }
        }

        // Replace sources for current page
        setSources(prev => [
            ...prev.filter(s => s.pageIndex !== currentPageIndex),
            ...newSources
        ])

        setStatusMessage(newSources.length > 0 ? `Found ${newSources.length} sources` : 'No sources detected')
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    const currentPageSources = sources.filter(s => s.pageIndex === currentPageIndex)
    const selectedSource = sources.find(s => s.id === selectedSourceId)

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
        <div className="h-screen flex flex-col bg-slate-100">
            {/* HEADER */}
            <header className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-slate-800">📜 Source Clipper</h1>

                    {statusMessage && (
                        <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                            {statusMessage}
                        </span>
                    )}
                </div>

                {pages.length > 0 && (
                    <div className="flex items-center gap-3">
                        {/* Page Navigation */}
                        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
                            <button
                                onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                                disabled={currentPageIndex === 0}
                                className="text-slate-600 disabled:text-slate-300 font-bold"
                            >
                                ←
                            </button>
                            <span className="text-sm font-medium min-w-[80px] text-center">
                                Page {currentPageIndex + 1} / {pages.length}
                            </span>
                            <button
                                onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
                                disabled={currentPageIndex === pages.length - 1}
                                className="text-slate-600 disabled:text-slate-300 font-bold"
                            >
                                →
                            </button>
                        </div>

                        {/* Quick Grid Dropdown */}
                        <div className="relative group">
                            <button className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg">
                                ⊞ Quick Grid
                            </button>
                            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg p-2 hidden group-hover:block z-10">
                                {[2, 3, 4, 5, 6].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => applyQuickGrid(n)}
                                        className="block w-full text-left px-3 py-1 text-sm hover:bg-blue-50 rounded"
                                    >
                                        {n} rows
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={reanalyzeCurrentPage}
                            className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                            🔄 Re-analyze
                        </button>

                        <button
                            onClick={clearCurrentPage}
                            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                        >
                            🗑 Clear Page
                        </button>

                        {/* View Toggle */}
                        <div className="flex bg-slate-100 rounded-lg p-0.5">
                            <button
                                onClick={() => setAppState('editing')}
                                className={`px-3 py-1 text-sm rounded ${appState === 'editing' ? 'bg-white shadow' : ''}`}
                            >
                                ✏️ Edit
                            </button>
                            <button
                                onClick={() => setAppState('preview')}
                                className={`px-3 py-1 text-sm rounded ${appState === 'preview' ? 'bg-white shadow' : ''}`}
                            >
                                👁 Preview
                            </button>
                        </div>

                        <span className="text-sm text-slate-500">
                            {sources.length} sources total
                        </span>
                    </div>
                )}
            </header>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex overflow-hidden">

                {/* UPLOAD STATE */}
                {appState === 'upload' && (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div
                            onClick={() => document.getElementById('file-upload')?.click()}
                            onDrop={(e) => {
                                e.preventDefault()
                                const f = e.dataTransfer.files[0]
                                if (f) handleFileUpload(f)
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            className="w-full max-w-md border-2 border-dashed border-blue-300 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all"
                        >
                            <div className="text-5xl mb-4">📄</div>
                            <h2 className="text-xl font-semibold text-slate-800 mb-2">Upload Source Sheet</h2>
                            <p className="text-slate-500 mb-4">PDF or Image file</p>
                            <p className="text-sm text-blue-600">
                                ✨ AI auto-detects sources + OCR + Sefaria lookup
                            </p>
                            {error && (
                                <p className="mt-4 text-red-600 text-sm">{error}</p>
                            )}
                            <input
                                id="file-upload"
                                type="file"
                                accept=".pdf,image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) handleFileUpload(f)
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* PROCESSING STATE */}
                {appState === 'processing' && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-5xl mb-4 animate-bounce">🔍</div>
                            <p className="text-lg font-medium text-slate-700">{statusMessage}</p>
                            <p className="text-sm text-slate-500 mt-2">This may take a moment...</p>
                        </div>
                    </div>
                )}

                {/* EDITING STATE */}
                {appState === 'editing' && pages.length > 0 && (
                    <>
                        {/* Canvas Area */}
                        <div className="flex-1 overflow-auto p-6 flex justify-center">
                            <div
                                ref={canvasRef}
                                className="relative inline-block cursor-crosshair"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            >
                                <img
                                    src={pages[currentPageIndex].imageDataUrl}
                                    alt={`Page ${currentPageIndex + 1}`}
                                    className="max-h-[calc(100vh-120px)] shadow-xl rounded-lg select-none pointer-events-none"
                                    draggable={false}
                                />

                                {/* Source Boxes */}
                                {currentPageSources.map((source, idx) => (
                                    <div
                                        key={source.id}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedSourceId(source.id)
                                        }}
                                        className={`absolute border-2 cursor-pointer transition-all ${selectedSourceId === source.id
                                            ? 'border-green-500 bg-green-500/20 shadow-lg z-10'
                                            : source.sefariaUrl
                                                ? 'border-purple-500 bg-purple-500/10 hover:bg-purple-500/20'
                                                : 'border-blue-500 bg-blue-500/10 hover:bg-blue-500/20'
                                            }`}
                                        style={{
                                            left: `${source.box.x}%`,
                                            top: `${source.box.y}%`,
                                            width: `${source.box.width}%`,
                                            height: `${source.box.height}%`
                                        }}
                                    >
                                        {/* Source Number Badge */}
                                        <span className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow">
                                            {idx + 1}
                                        </span>

                                        {/* Sefaria Badge */}
                                        {source.sefariaUrl && (
                                            <span className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-purple-600 text-white text-xs rounded-full flex items-center justify-center shadow">
                                                ✓
                                            </span>
                                        )}

                                        {/* Delete Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                deleteSource(source.id)
                                            }}
                                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}

                                {/* Drawing Preview */}
                                {isDrawing && drawStart && drawEnd && (
                                    <div
                                        className="absolute border-2 border-blue-600 bg-blue-500/30 pointer-events-none"
                                        style={{
                                            left: `${Math.min(drawStart.x, drawEnd.x)}%`,
                                            top: `${Math.min(drawStart.y, drawEnd.y)}%`,
                                            width: `${Math.abs(drawEnd.x - drawStart.x)}%`,
                                            height: `${Math.abs(drawEnd.y - drawStart.y)}%`
                                        }}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Sidebar */}
                        <aside className="w-80 bg-white border-l flex flex-col">
                            <div className="p-4 border-b bg-slate-50">
                                <h2 className="font-semibold text-slate-800">
                                    Sources on this page ({currentPageSources.length})
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    Click a box to select • Draw to add new
                                </p>
                            </div>

                            <div className="flex-1 overflow-auto">
                                {currentPageSources.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400">
                                        <p className="text-3xl mb-2">📦</p>
                                        <p>No sources on this page</p>
                                        <p className="text-xs mt-1">Draw boxes or use Quick Grid</p>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {currentPageSources.map((source, idx) => (
                                            <div
                                                key={source.id}
                                                onClick={() => setSelectedSourceId(source.id)}
                                                className={`p-3 cursor-pointer transition-colors ${selectedSourceId === source.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                                            {idx + 1}
                                                        </span>
                                                        <span className="font-medium text-slate-800 text-sm">
                                                            {source.reference || '(No reference)'}
                                                        </span>
                                                    </div>
                                                    {source.sefariaUrl && (
                                                        <a
                                                            href={source.sefariaUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="text-purple-600 text-xs hover:underline"
                                                        >
                                                            Sefaria ↗
                                                        </a>
                                                    )}
                                                </div>

                                                {source.text && (
                                                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed" dir="rtl">
                                                        {source.text.substring(0, 80)}...
                                                    </p>
                                                )}

                                                {/* Edit reference input */}
                                                {selectedSourceId === source.id && (
                                                    <div className="mt-3 pt-3 border-t">
                                                        <label className="text-xs font-medium text-slate-500 block mb-1">
                                                            Reference:
                                                        </label>
                                                        <div className="flex gap-1">
                                                            <input
                                                                type="text"
                                                                value={source.reference || ''}
                                                                onChange={(e) => updateSourceReference(source.id, e.target.value)}
                                                                placeholder="e.g., Bereishit 1:1"
                                                                className="flex-1 text-sm px-2 py-1 border rounded"
                                                            />
                                                            <button
                                                                onClick={() => lookupSource(source)}
                                                                disabled={!source.reference}
                                                                className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50"
                                                            >
                                                                🔍
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </aside>
                    </>
                )}

                {/* PREVIEW STATE */}
                {appState === 'preview' && (
                    <div className="flex-1 overflow-auto p-8 bg-white">
                        <div className="max-w-3xl mx-auto">
                            <h1 className="text-3xl font-serif font-bold text-center mb-8 pb-4 border-b">
                                Source Sheet
                            </h1>

                            {sources.length === 0 ? (
                                <p className="text-center text-slate-400 py-12">No sources to display</p>
                            ) : (
                                sources.map((source, idx) => (
                                    <div key={source.id} className="mb-8 pb-8 border-b last:border-0">
                                        <div className="flex items-baseline gap-3 mb-3">
                                            <span className="text-2xl font-bold text-blue-600">{idx + 1}.</span>
                                            {source.reference && (
                                                <span className="text-xl font-semibold">{source.reference}</span>
                                            )}
                                            {source.sefariaUrl && (
                                                <a
                                                    href={source.sefariaUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-purple-600 hover:underline"
                                                >
                                                    View on Sefaria →
                                                </a>
                                            )}
                                        </div>

                                        <div className="bg-slate-50 rounded-lg p-4" dir="rtl">
                                            <p className="text-lg leading-relaxed font-serif">
                                                {source.sefariaText || source.text || '(No text)'}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* FOOTER HINT */}
            {appState === 'editing' && currentPageSources.length === 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/75 text-white px-6 py-3 rounded-full text-sm">
                    ✏️ Draw rectangles around each source, or use Quick Grid above
                </div>
            )}
        </div>
    )
}
