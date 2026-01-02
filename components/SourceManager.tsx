'use client'

import { useState, useRef, useCallback, MouseEvent } from 'react'
import { Upload, Loader2, X, Check, Edit3, Search, ExternalLink, Sparkles, Grid3X3, RotateCcw, Download, ChevronLeft, ChevronRight } from 'lucide-react'

interface DetectedSource {
    id: string
    pageIndex: number
    box: { x: number; y: number; width: number; height: number }
    hebrewText: string
    reference: string | null
    sefariaData?: any
    confidence: number
    isManual?: boolean
}

type ViewMode = 'edit' | 'preview'

export default function SourceManager() {
    // File state
    const [pageImages, setPageImages] = useState<string[]>([])
    const [currentPage, setCurrentPage] = useState(0)
    const [fileName, setFileName] = useState<string>('')

    // Sources state
    const [sources, setSources] = useState<DetectedSource[]>([])
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

    // UI state
    const [isProcessing, setIsProcessing] = useState(false)
    const [processingStatus, setProcessingStatus] = useState('')
    const [viewMode, setViewMode] = useState<ViewMode>('edit')
    const [showQuickGrid, setShowQuickGrid] = useState(false)

    // Drawing state
    const [isDrawing, setIsDrawing] = useState(false)
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
    const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)

    // Convert PDF to images using PDF.js
    const pdfToImages = async (file: File): Promise<string[]> => {
        setProcessingStatus('Converting PDF to images...')

        const pdfjs = await import('pdfjs-dist')
        const pdfjsLib = pdfjs.default || pdfjs

        if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        }

        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const images: string[] = []

        for (let i = 1; i <= pdf.numPages; i++) {
            setProcessingStatus(`Rendering page ${i}/${pdf.numPages}...`)
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: 2 })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            const ctx = canvas.getContext('2d')!

            await page.render({
                canvasContext: ctx,
                viewport,
                canvas
            } as any).promise

            images.push(canvas.toDataURL('image/png'))
        }

        return images
    }

    // Analyze image with Gemini
    const analyzeWithGemini = async (imageDataUrl: string, pageIndex: number): Promise<DetectedSource[]> => {
        setProcessingStatus(`Analyzing page ${pageIndex + 1} with AI...`)

        // Convert data URL to blob
        const response = await fetch(imageDataUrl)
        const blob = await response.blob()
        const file = new File([blob], 'page.png', { type: 'image/png' })

        const formData = new FormData()
        formData.append('image', file)

        try {
            const res = await fetch('/api/sources/analyze', {
                method: 'POST',
                body: formData
            })

            const data = await res.json()

            if (data.sources && data.sources.length > 0) {
                return data.sources.map((s: any) => ({
                    ...s,
                    pageIndex
                }))
            }
        } catch (error) {
            console.error('Gemini analysis failed:', error)
        }

        return []
    }

    // Look up source in Sefaria
    const lookupSefaria = async (source: DetectedSource): Promise<any> => {
        if (!source.reference) return null

        try {
            const res = await fetch(`/api/sources/sefaria?ref=${encodeURIComponent(source.reference)}`)
            const data = await res.json()
            if (data.found) {
                return data
            }
        } catch (error) {
            console.error('Sefaria lookup failed:', error)
        }
        return null
    }

    // Process uploaded file
    const processFile = async (file: File) => {
        setIsProcessing(true)
        setFileName(file.name)
        setSources([])
        setPageImages([])
        setCurrentPage(0)

        try {
            // Step 1: Convert to images
            let images: string[] = []

            if (file.type === 'application/pdf') {
                images = await pdfToImages(file)
            } else {
                // Single image
                const dataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(reader.result as string)
                    reader.readAsDataURL(file)
                })
                images = [dataUrl]
            }

            setPageImages(images)

            // Step 2: Analyze each page with Gemini
            const allSources: DetectedSource[] = []

            for (let i = 0; i < images.length; i++) {
                const pageSources = await analyzeWithGemini(images[i], i)

                if (pageSources.length > 0) {
                    allSources.push(...pageSources)
                } else {
                    // Fallback: full page as single source
                    allSources.push({
                        id: `fallback-${i}`,
                        pageIndex: i,
                        box: { x: 5, y: 5, width: 90, height: 90 },
                        hebrewText: '(Auto-detection failed - draw boxes manually)',
                        reference: null,
                        confidence: 0
                    })
                }
            }

            // Step 3: Enrich with Sefaria data
            setProcessingStatus('Looking up sources in Sefaria...')
            for (const source of allSources) {
                if (source.reference) {
                    source.sefariaData = await lookupSefaria(source)
                }
            }

            setSources(allSources)
            setProcessingStatus('')

        } catch (error) {
            console.error('Processing failed:', error)
            setProcessingStatus('Error: ' + String(error))
        } finally {
            setIsProcessing(false)
        }
    }

    // Quick Grid: divide page into rows
    const applyQuickGrid = (rows: number, cols: number = 1) => {
        const newSources: DetectedSource[] = []
        const heightPercent = 90 / rows
        const widthPercent = 90 / cols

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                newSources.push({
                    id: `grid-${currentPage}-${r}-${c}`,
                    pageIndex: currentPage,
                    box: {
                        x: 5 + c * widthPercent,
                        y: 5 + r * heightPercent,
                        width: widthPercent,
                        height: heightPercent
                    },
                    hebrewText: '',
                    reference: null,
                    confidence: 1,
                    isManual: true
                })
            }
        }

        // Replace sources for current page
        setSources(prev => [
            ...prev.filter(s => s.pageIndex !== currentPage),
            ...newSources
        ])
        setShowQuickGrid(false)
    }

    // Drawing handlers
    const getRelativePos = (e: MouseEvent<HTMLDivElement>): { x: number; y: number } => {
        const rect = e.currentTarget.getBoundingClientRect()
        return {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100
        }
    }

    const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
        if (viewMode !== 'edit') return
        const pos = getRelativePos(e)
        setIsDrawing(true)
        setDrawStart(pos)
        setDrawCurrent(pos)
    }

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (!isDrawing) return
        setDrawCurrent(getRelativePos(e))
    }

    const handleMouseUp = () => {
        if (!isDrawing || !drawStart || !drawCurrent) {
            setIsDrawing(false)
            return
        }

        const x = Math.min(drawStart.x, drawCurrent.x)
        const y = Math.min(drawStart.y, drawCurrent.y)
        const width = Math.abs(drawCurrent.x - drawStart.x)
        const height = Math.abs(drawCurrent.y - drawStart.y)

        if (width > 3 && height > 3) {
            const newSource: DetectedSource = {
                id: `manual-${Date.now()}`,
                pageIndex: currentPage,
                box: { x, y, width, height },
                hebrewText: '',
                reference: null,
                confidence: 1,
                isManual: true
            }
            setSources(prev => [...prev, newSource])
        }

        setIsDrawing(false)
        setDrawStart(null)
        setDrawCurrent(null)
    }

    const deleteSource = (id: string) => {
        setSources(prev => prev.filter(s => s.id !== id))
        if (selectedSourceId === id) setSelectedSourceId(null)
    }

    const currentSources = sources.filter(s => s.pageIndex === currentPage)

    // Render
    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Header */}
            <header className="bg-white border-b shadow-sm px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-600" />
                        Source Clipper
                    </h1>
                    {fileName && (
                        <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                            {fileName}
                        </span>
                    )}
                </div>

                {pageImages.length > 0 && (
                    <div className="flex items-center gap-3">
                        {/* Page navigation */}
                        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1">
                            <button
                                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                                disabled={currentPage === 0}
                                className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium text-slate-700 min-w-[80px] text-center">
                                Page {currentPage + 1} / {pageImages.length}
                            </span>
                            <button
                                onClick={() => setCurrentPage(Math.min(pageImages.length - 1, currentPage + 1))}
                                disabled={currentPage === pageImages.length - 1}
                                className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Quick Grid */}
                        <div className="relative">
                            <button
                                onClick={() => setShowQuickGrid(!showQuickGrid)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <Grid3X3 className="w-4 h-4" />
                                Quick Grid
                            </button>
                            {showQuickGrid && (
                                <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border p-3 z-20">
                                    <p className="text-xs text-slate-500 mb-2">Split page into:</p>
                                    <div className="grid grid-cols-3 gap-1">
                                        {[2, 3, 4, 5, 6, 8].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => applyQuickGrid(n)}
                                                className="px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded"
                                            >
                                                {n} rows
                                            </button>
                                        ))}
                                    </div>
                                    <div className="border-t mt-2 pt-2">
                                        <button
                                            onClick={() => applyQuickGrid(2, 2)}
                                            className="w-full px-3 py-1.5 text-sm bg-purple-50 hover:bg-purple-100 text-purple-700 rounded"
                                        >
                                            2×2 Grid
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* View mode toggle */}
                        <div className="flex bg-slate-100 rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('edit')}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === 'edit' ? 'bg-white shadow text-blue-600' : 'text-slate-600'
                                    }`}
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => setViewMode('preview')}
                                className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === 'preview' ? 'bg-white shadow text-blue-600' : 'text-slate-600'
                                    }`}
                            >
                                Preview
                            </button>
                        </div>

                        <button className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                            <Download className="w-4 h-4" />
                            Export ({sources.length})
                        </button>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Upload State */}
                {pageImages.length === 0 && !isProcessing && (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <div
                            onClick={() => document.getElementById('file-input')?.click()}
                            onDrop={(e) => {
                                e.preventDefault()
                                const f = e.dataTransfer.files[0]
                                if (f) processFile(f)
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            className="relative w-full max-w-lg border-2 border-dashed border-blue-300 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all group"
                        >
                            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800 mb-2">Upload Source Sheet</h3>
                            <p className="text-slate-500 mb-4">PDF or Image file</p>
                            <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                                <Sparkles className="w-4 h-4" />
                                AI auto-detects sources + OCR + Sefaria lookup
                            </div>
                            <input
                                id="file-input"
                                type="file"
                                className="hidden"
                                accept=".pdf,image/*"
                                onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) processFile(f)
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Processing State */}
                {isProcessing && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                            <p className="text-lg font-medium text-slate-700">{processingStatus || 'Processing...'}</p>
                            <p className="text-sm text-slate-500 mt-2">AI is analyzing your source sheet</p>
                        </div>
                    </div>
                )}

                {/* Editor View */}
                {!isProcessing && pageImages.length > 0 && viewMode === 'edit' && (
                    <>
                        {/* Canvas */}
                        <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
                            <div
                                className="relative inline-block cursor-crosshair"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            >
                                <img
                                    src={pageImages[currentPage]}
                                    className="max-h-[calc(100vh-150px)] w-auto shadow-xl rounded-lg select-none pointer-events-none"
                                    draggable={false}
                                />

                                {/* Source boxes */}
                                {currentSources.map((source, idx) => (
                                    <div
                                        key={source.id}
                                        onClick={() => setSelectedSourceId(source.id)}
                                        className={`absolute border-2 transition-all cursor-pointer ${selectedSourceId === source.id
                                                ? 'border-green-500 bg-green-500/15 shadow-lg'
                                                : source.sefariaData
                                                    ? 'border-purple-500 bg-purple-500/10'
                                                    : 'border-blue-500 bg-blue-500/10 hover:bg-blue-500/20'
                                            }`}
                                        style={{
                                            left: `${source.box.x}%`,
                                            top: `${source.box.y}%`,
                                            width: `${source.box.width}%`,
                                            height: `${source.box.height}%`,
                                        }}
                                    >
                                        <span className="absolute -top-2 -left-2 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold shadow">
                                            {idx + 1}
                                        </span>
                                        {source.sefariaData && (
                                            <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs p-0.5 rounded-full">
                                                <Check className="w-3 h-3" />
                                            </span>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteSource(source.id); }}
                                            className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded opacity-0 hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}

                                {/* Drawing preview */}
                                {isDrawing && drawStart && drawCurrent && (
                                    <div
                                        className="absolute border-2 border-blue-600 bg-blue-500/20 pointer-events-none"
                                        style={{
                                            left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                                            top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                                            width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
                                            height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
                                        }}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Sidebar */}
                        <aside className="w-80 bg-white border-l overflow-auto flex flex-col">
                            <div className="p-4 border-b bg-slate-50">
                                <h2 className="font-semibold text-slate-800">Sources ({currentSources.length})</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Click to select, draw to add new</p>
                            </div>

                            <div className="flex-1 overflow-auto divide-y">
                                {currentSources.map((source, idx) => (
                                    <div
                                        key={source.id}
                                        onClick={() => setSelectedSourceId(source.id)}
                                        className={`p-3 cursor-pointer transition-colors ${selectedSourceId === source.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                                                    {idx + 1}
                                                </span>
                                                {source.reference ? (
                                                    <span className="text-sm font-medium text-slate-800">{source.reference}</span>
                                                ) : (
                                                    <span className="text-sm text-slate-400 italic">No reference detected</span>
                                                )}
                                            </div>
                                            {source.sefariaData && (
                                                <a
                                                    href={source.sefariaData.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-purple-600 hover:text-purple-700"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>

                                        {source.hebrewText && (
                                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed" dir="rtl">
                                                {source.hebrewText.substring(0, 100)}...
                                            </p>
                                        )}

                                        <div className="flex items-center gap-2 mt-2">
                                            {source.sefariaData ? (
                                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Sefaria
                                                </span>
                                            ) : source.reference ? (
                                                <button className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1 hover:bg-slate-200">
                                                    <Search className="w-3 h-3" /> Look up
                                                </button>
                                            ) : null}
                                            <span className="text-xs text-slate-400">
                                                {Math.round(source.confidence * 100)}% conf
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {currentSources.length === 0 && (
                                    <div className="p-8 text-center text-slate-400">
                                        <Grid3X3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">Draw boxes around sources<br />or use Quick Grid</p>
                                    </div>
                                )}
                            </div>
                        </aside>
                    </>
                )}

                {/* Preview Mode */}
                {!isProcessing && pageImages.length > 0 && viewMode === 'preview' && (
                    <div className="flex-1 overflow-auto p-8">
                        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg border p-8">
                            <h2 className="text-2xl font-serif font-bold text-center text-slate-800 mb-8 pb-4 border-b">
                                Source Sheet Preview
                            </h2>

                            {sources.map((source, idx) => (
                                <div key={source.id} className="mb-6 pb-6 border-b last:border-0">
                                    <div className="flex items-baseline gap-3 mb-3">
                                        <span className="text-lg font-bold text-blue-600">{idx + 1}.</span>
                                        {source.reference && (
                                            <span className="text-lg font-semibold text-slate-800">{source.reference}</span>
                                        )}
                                        {source.sefariaData && (
                                            <a
                                                href={source.sefariaData.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-purple-600 hover:underline"
                                            >
                                                View on Sefaria →
                                            </a>
                                        )}
                                    </div>

                                    <div className="bg-slate-50 rounded-lg p-4" dir="rtl">
                                        <p className="text-lg leading-relaxed text-slate-800 font-serif">
                                            {source.sefariaData?.hebrewText || source.hebrewText || '(No text extracted)'}
                                        </p>
                                    </div>

                                    {source.sefariaData?.text && (
                                        <div className="mt-3 text-sm text-slate-600 italic">
                                            {source.sefariaData.text.substring(0, 200)}...
                                        </div>
                                    )}
                                </div>
                            ))}

                            {sources.length === 0 && (
                                <p className="text-center text-slate-400 py-12">
                                    No sources detected yet
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
