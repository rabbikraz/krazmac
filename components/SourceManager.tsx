'use client'

import { useState, useRef, useEffect } from 'react'

// ============================================================================
// TYPES
// ============================================================================

interface Source {
    id: string
    pageIndex: number
    box: { x: number; y: number; width: number; height: number } | null
    polygon: Array<{ x: number; y: number }> | null
    rotation: number
    clippedImage: string | null
    name: string
    reference: string | null
    displaySize: number  // Percentage 25-100 for how big to show on shiur page
}

interface PageData {
    imageDataUrl: string
    width: number
    height: number
    imageElement: HTMLImageElement | null
}

interface Shiur {
    id: string
    title: string
    slug: string
}

type AppState = 'upload' | 'processing' | 'editing' | 'preview'
type DrawMode = 'rectangle' | 'polygon'

// ============================================================================
// PDF TO IMAGES
// ============================================================================

async function convertPdfToImages(file: File): Promise<PageData[]> {
    const pdfjs = await import('pdfjs-dist')
    const pdfjsLib = pdfjs.default || pdfjs
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pages: PageData[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const scale = 2
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport } as any).promise
        const dataUrl = canvas.toDataURL('image/png')
        const img = new Image()
        img.src = dataUrl
        await new Promise(resolve => { img.onload = resolve })
        pages.push({ imageDataUrl: dataUrl, width: viewport.width, height: viewport.height, imageElement: img })
    }
    return pages
}

async function convertImageToDataUrl(file: File): Promise<PageData> {
    return new Promise((resolve) => {
        const reader = new FileReader()
        const img = new Image()
        reader.onload = () => {
            img.onload = () => {
                resolve({ imageDataUrl: reader.result as string, width: img.width, height: img.height, imageElement: img })
            }
            img.src = reader.result as string
        }
        reader.readAsDataURL(file)
    })
}

// ============================================================================
// CLIPPING FUNCTION
// ============================================================================

function clipSourceImage(source: Source, page: PageData): string | null {
    if (!page.imageElement) return null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    if (source.box) {
        const sx = (source.box.x / 100) * page.width
        const sy = (source.box.y / 100) * page.height
        const sw = (source.box.width / 100) * page.width
        const sh = (source.box.height / 100) * page.height
        const angle = (source.rotation * Math.PI) / 180
        const cos = Math.abs(Math.cos(angle))
        const sin = Math.abs(Math.sin(angle))
        const newW = sw * cos + sh * sin
        const newH = sw * sin + sh * cos
        canvas.width = newW
        canvas.height = newH
        ctx.save()
        ctx.translate(newW / 2, newH / 2)
        ctx.rotate(angle)
        ctx.drawImage(page.imageElement, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh)
        ctx.restore()
        return canvas.toDataURL('image/png')
    } else if (source.polygon && source.polygon.length >= 3) {
        const points = source.polygon.map(p => ({ x: (p.x / 100) * page.width, y: (p.y / 100) * page.height }))
        const minX = Math.min(...points.map(p => p.x))
        const maxX = Math.max(...points.map(p => p.x))
        const minY = Math.min(...points.map(p => p.y))
        const maxY = Math.max(...points.map(p => p.y))
        canvas.width = maxX - minX
        canvas.height = maxY - minY
        ctx.beginPath()
        ctx.moveTo(points[0].x - minX, points[0].y - minY)
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x - minX, points[i].y - minY)
        }
        ctx.closePath()
        ctx.clip()
        const angle = (source.rotation * Math.PI) / 180
        ctx.save()
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate(angle)
        ctx.translate(-canvas.width / 2, -canvas.height / 2)
        ctx.drawImage(page.imageElement, minX, minY, maxX - minX, maxY - minY, 0, 0, maxX - minX, maxY - minY)
        ctx.restore()
        return canvas.toDataURL('image/png')
    }
    return null
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SourceManager() {
    const [appState, setAppState] = useState<AppState>('upload')
    const [pages, setPages] = useState<PageData[]>([])
    const [sources, setSources] = useState<Source[]>([])
    const [currentPageIndex, setCurrentPageIndex] = useState(0)
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [drawMode, setDrawMode] = useState<DrawMode>('rectangle')

    // Rectangle drawing
    const [isDrawing, setIsDrawing] = useState(false)
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
    const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null)

    // Polygon drawing
    const [polygonPoints, setPolygonPoints] = useState<Array<{ x: number; y: number }>>([])
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

    // Editing (drag/resize)
    const [editMode, setEditMode] = useState<'none' | 'drag' | 'resize' | 'rotate'>('none')
    const [editingSourceId, setEditingSourceId] = useState<string | null>(null)
    const [editStart, setEditStart] = useState<{ x: number; y: number; box?: { x: number; y: number; width: number; height: number }; rotation?: number } | null>(null)
    const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null)

    // Shiur attachment
    const [shiurim, setShiurim] = useState<Shiur[]>([])
    const [selectedShiurId, setSelectedShiurId] = useState<string | null>(null)
    const [loadingShiurim, setLoadingShiurim] = useState(false)

    const canvasRef = useRef<HTMLDivElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)

    // Load shiurim list
    useEffect(() => {
        const loadShiurim = async () => {
            setLoadingShiurim(true)
            try {
                const res = await fetch('/api/shiurim')
                const data = await res.json()
                // API returns array directly, not { shiurim: [...] }
                if (Array.isArray(data)) {
                    setShiurim(data.map((s: any) => ({ id: s.id, title: s.title, slug: s.slug })))
                } else {
                    console.error('Unexpected shiurim response:', data)
                }
            } catch (e) {
                console.error('Failed to load shiurim:', e)
            }
            setLoadingShiurim(false)
        }
        loadShiurim()
    }, [])

    // Auto-generate clipped images
    useEffect(() => {
        const updated = sources.map(s => {
            if (!s.clippedImage && (s.box || s.polygon)) {
                const page = pages[s.pageIndex]
                if (page) return { ...s, clippedImage: clipSourceImage(s, page) }
            }
            return s
        })
        const hasChanges = updated.some((s, i) => s.clippedImage !== sources[i].clippedImage)
        if (hasChanges) setSources(updated)
    }, [sources, pages])

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
                setStatusMessage('Converting PDF...')
                pageData = await convertPdfToImages(file)
            } else {
                setStatusMessage('Loading image...')
                pageData = [await convertImageToDataUrl(file)]
            }
            setPages(pageData)
            setStatusMessage(`Analyzing ${pageData.length} page(s)...`)

            const allSources: Source[] = []
            for (let i = 0; i < pageData.length; i++) {
                setStatusMessage(`Analyzing page ${i + 1}...`)
                const pageSources = await analyzePageWithGemini(pageData[i], i)
                allSources.push(...pageSources)
            }

            for (const source of allSources) {
                source.clippedImage = clipSourceImage(source, pageData[source.pageIndex])
            }

            setSources(allSources)
            setStatusMessage(allSources.length > 0 ? `Found ${allSources.length} sources` : 'Draw sources manually')
            setAppState('editing')
        } catch (err) {
            setError(String(err))
            setAppState('upload')
        }
    }

    const analyzePageWithGemini = async (page: PageData, pageIndex: number): Promise<Source[]> => {
        try {
            const response = await fetch(page.imageDataUrl)
            const blob = await response.blob()
            const file = new File([blob], 'page.png', { type: 'image/png' })
            const formData = new FormData()
            formData.append('image', file)

            const res = await fetch('/api/sources/analyze', { method: 'POST', body: formData })
            const data = await res.json() as { success: boolean; sources?: Array<{ id?: string; box: { x: number; y: number; width: number; height: number }; text?: string; reference?: string | null }> }

            if (data.success && data.sources?.length) {
                return data.sources.map((s, idx) => ({
                    id: s.id || `src-${Date.now()}-${idx}`,
                    pageIndex,
                    box: s.box,
                    polygon: null,
                    rotation: 0,
                    clippedImage: null,
                    name: s.reference || `Source ${idx + 1}`,
                    reference: s.reference || null,
                    displaySize: 75
                }))
            }
            return []
        } catch { return [] }
    }

    // ============================================================================
    // SOURCE MANAGEMENT
    // ============================================================================

    const deleteSource = (id: string) => {
        setSources(prev => prev.filter(s => s.id !== id))
        if (selectedSourceId === id) setSelectedSourceId(null)
    }

    const updateSourceName = (id: string, name: string) => {
        setSources(prev => prev.map(s => s.id === id ? { ...s, name } : s))
    }

    const updateSourceRotation = (id: string, rotation: number) => {
        setSources(prev => prev.map(s => s.id === id ? { ...s, rotation, clippedImage: null } : s))
    }

    const updateSourceDisplaySize = (id: string, displaySize: number) => {
        setSources(prev => prev.map(s => s.id === id ? { ...s, displaySize } : s))
    }

    const clearPage = () => {
        setSources(prev => prev.filter(s => s.pageIndex !== currentPageIndex))
    }

    const applyQuickGrid = (rows: number) => {
        const rowHeight = 90 / rows
        const newSources: Source[] = []
        for (let i = 0; i < rows; i++) {
            newSources.push({
                id: `grid-${Date.now()}-${i}`,
                pageIndex: currentPageIndex,
                box: { x: 5, y: 5 + i * rowHeight, width: 90, height: rowHeight },
                polygon: null,
                rotation: 0,
                clippedImage: null,
                name: `Source ${i + 1}`,
                reference: null,
                displaySize: 75
            })
        }
        setSources(prev => [...prev.filter(s => s.pageIndex !== currentPageIndex), ...newSources])
    }

    // ============================================================================
    // DRAWING / EDITING
    // ============================================================================

    const getPos = (e: React.MouseEvent) => {
        // Use the image element directly for accurate positioning
        if (!imageRef.current) return { x: 0, y: 0 }
        const rect = imageRef.current.getBoundingClientRect()
        // clientX/clientY are relative to viewport - rect is also relative to viewport
        // This should work correctly even with scrolling
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        return {
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y))
        }
    }

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (drawMode === 'polygon' && appState === 'editing') {
            setPolygonPoints(prev => [...prev, getPos(e)])
        }
    }

    const finishPolygon = () => {
        if (polygonPoints.length >= 3) {
            setSources(prev => [...prev, {
                id: `poly-${Date.now()}`,
                pageIndex: currentPageIndex,
                box: null,
                polygon: [...polygonPoints],
                rotation: 0,
                clippedImage: null,
                name: `Polygon ${prev.length + 1}`,
                reference: null,
                displaySize: 75
            }])
        }
        setPolygonPoints([])
    }

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (appState !== 'editing' || drawMode !== 'rectangle' || editMode !== 'none') return
        e.preventDefault() // Prevent text selection
        const pos = getPos(e)
        setIsDrawing(true)
        setDrawStart(pos)
        setDrawEnd(pos)
        setSelectedSourceId(null)
    }

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const pos = getPos(e)

        // Rotating - with damping for less sensitivity
        if (editMode === 'rotate' && editingSourceId && editStart) {
            const source = sources.find(s => s.id === editingSourceId)
            if (source?.box) {
                const centerX = source.box.x + source.box.width / 2
                const centerY = source.box.y + source.box.height / 2
                const rawAngle = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI)
                // Add 90 degrees offset so 0° is at top, and dampen to 2° steps
                const adjustedAngle = rawAngle + 90
                const snappedAngle = Math.round(adjustedAngle / 2) * 2
                // Normalize to -180 to 180
                const normalizedAngle = ((snappedAngle + 180) % 360) - 180
                updateSourceRotation(editingSourceId, normalizedAngle)
            }
            return
        }

        // Dragging
        if (editMode === 'drag' && editingSourceId && editStart?.box) {
            const dx = pos.x - editStart.x
            const dy = pos.y - editStart.y
            setSources(prev => prev.map(s => {
                if (s.id !== editingSourceId || !s.box) return s
                return {
                    ...s,
                    box: {
                        ...s.box,
                        x: Math.max(0, Math.min(100 - editStart.box!.width, editStart.box!.x + dx)),
                        y: Math.max(0, Math.min(100 - editStart.box!.height, editStart.box!.y + dy))
                    },
                    clippedImage: null
                }
            }))
            return
        }

        // Resizing
        if (editMode === 'resize' && editingSourceId && editStart?.box && resizeHandle) {
            const dx = pos.x - editStart.x
            const dy = pos.y - editStart.y
            setSources(prev => prev.map(s => {
                if (s.id !== editingSourceId || !s.box) return s
                let { x, y, width, height } = editStart.box!
                if (resizeHandle.includes('w')) { x += dx; width -= dx }
                if (resizeHandle.includes('e')) { width += dx }
                if (resizeHandle.includes('n')) { y += dy; height -= dy }
                if (resizeHandle.includes('s')) { height += dy }
                return { ...s, box: { x: Math.max(0, x), y: Math.max(0, y), width: Math.max(5, width), height: Math.max(5, height) }, clippedImage: null }
            }))
            return
        }

        if (isDrawing) setDrawEnd(pos)
    }

    const handleMouseUp = () => {
        if (editMode !== 'none') {
            setEditMode('none')
            setEditingSourceId(null)
            setEditStart(null)
            setResizeHandle(null)
            return
        }

        if (!isDrawing || !drawStart || !drawEnd) { setIsDrawing(false); return }

        const x = Math.min(drawStart.x, drawEnd.x)
        const y = Math.min(drawStart.y, drawEnd.y)
        const width = Math.abs(drawEnd.x - drawStart.x)
        const height = Math.abs(drawEnd.y - drawStart.y)

        if (width > 3 && height > 3) {
            setSources(prev => [...prev, {
                id: `rect-${Date.now()}`,
                pageIndex: currentPageIndex,
                box: { x, y, width, height },
                polygon: null,
                rotation: 0,
                clippedImage: null,
                name: `Source ${prev.length + 1}`,
                reference: null,
                displaySize: 75
            }])
        }
        setIsDrawing(false)
        setDrawStart(null)
        setDrawEnd(null)
    }

    const startDrag = (e: React.MouseEvent, source: Source) => {
        if (!source.box) return
        e.stopPropagation()
        e.preventDefault() // Prevent text selection
        setEditMode('drag')
        setEditingSourceId(source.id)
        setEditStart({ ...getPos(e), box: { ...source.box } })
        setSelectedSourceId(source.id)
    }

    const startResize = (e: React.MouseEvent, source: Source, handle: 'nw' | 'ne' | 'sw' | 'se') => {
        if (!source.box) return
        e.stopPropagation()
        e.preventDefault() // Prevent text selection
        setEditMode('resize')
        setResizeHandle(handle)
        setEditingSourceId(source.id)
        setEditStart({ ...getPos(e), box: { ...source.box } })
        setSelectedSourceId(source.id)
    }

    const startRotate = (e: React.MouseEvent, source: Source) => {
        e.stopPropagation()
        e.preventDefault() // Prevent text selection
        setEditMode('rotate')
        setEditingSourceId(source.id)
        setEditStart({ ...getPos(e), rotation: source.rotation })
        setSelectedSourceId(source.id)
    }

    const currentPageSources = sources.filter(s => s.pageIndex === currentPageIndex)

    // ============================================================================
    // APPLY TO SHIUR
    // ============================================================================

    const [saving, setSaving] = useState(false)

    const applyToShiur = async () => {
        if (!selectedShiurId) {
            alert('Please select a shiur first')
            return
        }

        setSaving(true)
        setStatusMessage('Generating source sheet...')

        try {
            // Combine all source images into one PDF-like image
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')!

            // Calculate total height needed
            const imgWidth = 800
            let totalHeight = 0
            const loadedImages: HTMLImageElement[] = []

            for (const source of sources) {
                if (source.clippedImage) {
                    const img = new Image()
                    img.src = source.clippedImage
                    await new Promise(resolve => { img.onload = resolve })
                    const aspectRatio = img.height / img.width
                    totalHeight += imgWidth * aspectRatio + 40 // 40px padding between
                    loadedImages.push(img)
                }
            }

            canvas.width = imgWidth
            canvas.height = totalHeight + 60

            // White background
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Draw each source
            let yOffset = 30
            sources.forEach((source, idx) => {
                if (source.clippedImage && loadedImages[idx]) {
                    const img = loadedImages[idx]
                    const aspectRatio = img.height / img.width
                    const h = imgWidth * aspectRatio

                    // Draw source name
                    ctx.fillStyle = '#1e293b'
                    ctx.font = 'bold 16px system-ui'
                    ctx.fillText(`${idx + 1}. ${source.name}`, 10, yOffset - 5)

                    // Draw image
                    ctx.drawImage(img, 0, yOffset, imgWidth, h)
                    yOffset += h + 40
                }
            })

            // Store as JSON with individual source images for HTML rendering
            const sourceData = sources.map((source) => ({
                id: source.id,
                name: source.name,
                image: source.clippedImage,
                rotation: source.rotation,
                reference: source.reference,
                displaySize: source.displaySize || 75
            }))

            // Save as JSON string to sourcesJson field (separate from PDF link in sourceDoc)
            const sourcesJsonStr = JSON.stringify(sourceData)

            // Upload to the shiur
            setStatusMessage('Uploading to shiur...')

            const res = await fetch(`/api/shiurim/${selectedShiurId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourcesJson: sourcesJsonStr
                })
            })

            if (!res.ok) {
                const errData = await res.json() as { error?: string }
                throw new Error(errData.error || 'Failed to update shiur')
            }

            const shiur = shiurim.find(s => s.id === selectedShiurId)
            setStatusMessage(`✓ Applied to "${shiur?.title}"`)
            alert(`Source sheet successfully applied to "${shiur?.title}"!\n\nThe sources have been saved and will display on the shiur page.`)

        } catch (err) {
            console.error('Failed to apply:', err)
            alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
            setStatusMessage('Failed to apply')
        }

        setSaving(false)
    }

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
        <div className="h-screen flex flex-col bg-slate-100">
            {/* HEADER - Only show when editing/preview */}
            {(appState === 'editing' || appState === 'preview') && pages.length > 0 && (
                <header className="bg-white border-b px-4 py-2 flex items-center justify-between shadow-sm">
                    <h1 className="text-lg font-bold text-slate-800">📜 Source Clipper</h1>

                    <div className="flex items-center gap-2 text-sm">
                        {/* Draw mode */}
                        <div className="flex bg-slate-100 rounded p-0.5">
                            <button onClick={() => { setDrawMode('rectangle'); setPolygonPoints([]) }} className={`px-2 py-1 rounded ${drawMode === 'rectangle' ? 'bg-white shadow' : ''}`}>▭ Rect</button>
                            <button onClick={() => setDrawMode('polygon')} className={`px-2 py-1 rounded ${drawMode === 'polygon' ? 'bg-white shadow' : ''}`}>⬡ Poly</button>
                        </div>

                        {polygonPoints.length > 0 && (
                            <>
                                <span className="text-slate-500">{polygonPoints.length} pts</span>
                                <button onClick={finishPolygon} disabled={polygonPoints.length < 3} className="px-2 py-1 bg-green-500 text-white rounded disabled:opacity-50">✓</button>
                                <button onClick={() => setPolygonPoints([])} className="px-2 py-1 bg-red-500 text-white rounded">✗</button>
                            </>
                        )}

                        {/* Page nav */}
                        <div className="flex items-center gap-1 bg-slate-100 rounded px-2 py-1">
                            <button onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))} disabled={currentPageIndex === 0} className="disabled:opacity-30">←</button>
                            <span>{currentPageIndex + 1}/{pages.length}</span>
                            <button onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))} disabled={currentPageIndex === pages.length - 1} className="disabled:opacity-30">→</button>
                        </div>

                        {/* Quick Grid */}
                        <div className="relative group">
                            <button className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded">Grid</button>
                            <div className="absolute right-0 top-full mt-1 bg-white border rounded shadow-lg p-1 hidden group-hover:block z-20 min-w-[80px]">
                                {[2, 3, 4, 5, 6].map(n => (
                                    <button key={n} onClick={() => applyQuickGrid(n)} className="block w-full text-left px-3 py-1 hover:bg-blue-50 rounded whitespace-nowrap">{n} rows</button>
                                ))}
                            </div>
                        </div>

                        <button onClick={clearPage} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded">Clear</button>

                        {/* View toggle */}
                        <div className="flex bg-slate-100 rounded p-0.5">
                            <button onClick={() => setAppState('editing')} className={`px-2 py-1 rounded ${appState === 'editing' ? 'bg-white shadow' : ''}`}>Edit</button>
                            <button onClick={() => setAppState('preview')} className={`px-2 py-1 rounded ${appState === 'preview' ? 'bg-white shadow' : ''}`}>Preview</button>
                        </div>

                        {statusMessage && <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">{statusMessage}</span>}
                    </div>
                </header>
            )}

            {/* MAIN */}
            <div className="flex-1 flex overflow-hidden">
                {/* UPLOAD */}
                {appState === 'upload' && (
                    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
                        <div className="max-w-lg w-full mx-auto p-8">
                            {/* Logo/Title */}
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-4">
                                    <span className="text-4xl">📜</span>
                                </div>
                                <h1 className="text-3xl font-bold text-slate-800">Source Clipper</h1>
                                <p className="text-slate-500 mt-2">Create beautiful source sheets from PDFs</p>
                            </div>

                            {/* Upload Box */}
                            <div
                                onClick={() => document.getElementById('file-input')?.click()}
                                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
                                onDragOver={(e) => e.preventDefault()}
                                className="bg-white border-2 border-dashed border-blue-300 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all shadow-lg hover:shadow-xl"
                            >
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-semibold text-slate-800 mb-2">Drop your PDF here</h2>
                                <p className="text-slate-500 mb-4">or click to browse files</p>
                                <div className="inline-flex items-center gap-2 text-sm text-slate-400">
                                    <span className="px-2 py-1 bg-slate-100 rounded">PDF</span>
                                    <span className="px-2 py-1 bg-slate-100 rounded">PNG</span>
                                    <span className="px-2 py-1 bg-slate-100 rounded">JPG</span>
                                </div>
                                {error && <p className="text-red-600 mt-4 font-medium">{error}</p>}
                                <input id="file-input" type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />
                            </div>

                            {/* Features */}
                            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                                <div className="p-3">
                                    <div className="text-2xl mb-1">✂️</div>
                                    <p className="text-xs text-slate-600">Clip Sources</p>
                                </div>
                                <div className="p-3">
                                    <div className="text-2xl mb-1">🔄</div>
                                    <p className="text-xs text-slate-600">Rotate & Resize</p>
                                </div>
                                <div className="p-3">
                                    <div className="text-2xl mb-1">📎</div>
                                    <p className="text-xs text-slate-600">Attach to Shiur</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* PROCESSING */}
                {appState === 'processing' && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-5xl mb-4 animate-bounce">🔍</div>
                            <p className="text-lg">{statusMessage}</p>
                        </div>
                    </div>
                )}

                {/* EDITING */}
                {appState === 'editing' && pages.length > 0 && (
                    <>
                        <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
                            <div
                                ref={canvasRef}
                                className="relative inline-flex cursor-crosshair select-none"
                                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                                onClick={handleCanvasClick}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            >
                                <img
                                    ref={imageRef}
                                    src={pages[currentPageIndex].imageDataUrl}
                                    alt="Page"
                                    className="max-h-[calc(100vh-100px)] shadow-xl rounded-lg pointer-events-none select-none block"
                                    draggable={false}
                                />

                                {/* Render sources - overlay on same coordinate system as image */}
                                {currentPageSources.map((source, idx) => {
                                    if (source.box) {
                                        const isSelected = selectedSourceId === source.id
                                        return (
                                            <div
                                                key={source.id}
                                                onClick={(e) => { e.stopPropagation(); setSelectedSourceId(source.id) }}
                                                className={`absolute border-2 ${isSelected ? 'border-green-500 bg-green-500/20 z-20' : 'border-blue-500 bg-blue-500/10'}`}
                                                style={{
                                                    left: `${source.box.x}%`, top: `${source.box.y}%`,
                                                    width: `${source.box.width}%`, height: `${source.box.height}%`,
                                                    transform: source.rotation ? `rotate(${source.rotation}deg)` : undefined,
                                                    transformOrigin: 'center'
                                                }}
                                            >
                                                {/* Number */}
                                                <span className="absolute -top-3 -left-3 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow">{idx + 1}</span>

                                                {/* Delete */}
                                                <button onClick={(e) => { e.stopPropagation(); deleteSource(source.id) }} className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full shadow">×</button>

                                                {/* ROTATION HANDLE - Circular, positioned outside the box */}
                                                <div
                                                    onMouseDown={(e) => startRotate(e, source)}
                                                    className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-orange-500 hover:bg-orange-600 rounded-full cursor-grab flex items-center justify-center text-white text-xs shadow-lg"
                                                    title={`Rotate (${source.rotation}°)`}
                                                >
                                                    ↻
                                                </div>
                                                {/* Rotation indicator line */}
                                                <div className="absolute -top-5 left-1/2 w-px h-3 bg-orange-500" />

                                                {/* Drag area */}
                                                <div onMouseDown={(e) => startDrag(e, source)} className="absolute inset-2 cursor-move" />

                                                {/* Resize handles */}
                                                <div onMouseDown={(e) => startResize(e, source, 'nw')} className="absolute -top-1 -left-1 w-3 h-3 bg-blue-600 cursor-nw-resize" />
                                                <div onMouseDown={(e) => startResize(e, source, 'ne')} className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 cursor-ne-resize" />
                                                <div onMouseDown={(e) => startResize(e, source, 'sw')} className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-600 cursor-sw-resize" />
                                                <div onMouseDown={(e) => startResize(e, source, 'se')} className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 cursor-se-resize" />
                                            </div>
                                        )
                                    } else if (source.polygon && source.polygon.length >= 3) {
                                        return (
                                            <svg key={source.id} className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: source.rotation ? `rotate(${source.rotation}deg)` : undefined }}>
                                                <polygon
                                                    points={source.polygon.map(p => `${p.x}%,${p.y}%`).join(' ')}
                                                    fill={selectedSourceId === source.id ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.15)'}
                                                    stroke={selectedSourceId === source.id ? '#22c55e' : '#3b82f6'}
                                                    strokeWidth="2"
                                                    className="pointer-events-auto cursor-pointer"
                                                    onClick={() => setSelectedSourceId(source.id)}
                                                />
                                            </svg>
                                        )
                                    }
                                    return null
                                })}

                                {/* Drawing preview - rectangle */}
                                {isDrawing && drawStart && drawEnd && (
                                    <div className="absolute border-2 border-blue-600 bg-blue-500/30 pointer-events-none" style={{
                                        left: `${Math.min(drawStart.x, drawEnd.x)}%`, top: `${Math.min(drawStart.y, drawEnd.y)}%`,
                                        width: `${Math.abs(drawEnd.x - drawStart.x)}%`, height: `${Math.abs(drawEnd.y - drawStart.y)}%`
                                    }} />
                                )}

                                {/* Drawing preview - polygon with LINES */}
                                {polygonPoints.length > 0 && (
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 50 }}>
                                        {/* Filled preview area */}
                                        {polygonPoints.length >= 3 && (
                                            <polygon
                                                points={polygonPoints.map(p => `${p.x}%,${p.y}%`).join(' ')}
                                                fill="rgba(59, 130, 246, 0.15)"
                                                stroke="none"
                                            />
                                        )}
                                        {/* Lines connecting all points - ALWAYS visible */}
                                        {polygonPoints.length > 1 && (
                                            <polyline
                                                points={polygonPoints.map(p => `${p.x}%,${p.y}%`).join(' ')}
                                                fill="none"
                                                stroke="#2563eb"
                                                strokeWidth="2"
                                            />
                                        )}
                                        {/* Closing line preview - dashed */}
                                        {polygonPoints.length >= 3 && (
                                            <line
                                                x1={`${polygonPoints[polygonPoints.length - 1].x}%`}
                                                y1={`${polygonPoints[polygonPoints.length - 1].y}%`}
                                                x2={`${polygonPoints[0].x}%`}
                                                y2={`${polygonPoints[0].y}%`}
                                                stroke="#2563eb"
                                                strokeWidth="2"
                                                strokeDasharray="5,5"
                                            />
                                        )}
                                        {/* Points - larger and more visible */}
                                        {polygonPoints.map((p, i) => (
                                            <circle
                                                key={i}
                                                cx={`${p.x}%`}
                                                cy={`${p.y}%`}
                                                r="6"
                                                fill="#2563eb"
                                                stroke="white"
                                                strokeWidth="2"
                                            />
                                        ))}
                                        {/* Point labels */}
                                        {polygonPoints.map((p, i) => (
                                            <text
                                                key={`label-${i}`}
                                                x={`${p.x}%`}
                                                y={`${p.y}%`}
                                                dy="-12"
                                                textAnchor="middle"
                                                fontSize="10"
                                                fill="#1e40af"
                                                fontWeight="bold"
                                            >
                                                {i + 1}
                                            </text>
                                        ))}
                                    </svg>
                                )}
                            </div>
                        </div>

                        {/* Sidebar - source list */}
                        <aside className="w-80 bg-white border-l flex flex-col">
                            <div className="p-3 border-b bg-slate-50 font-semibold">Sources ({currentPageSources.length})</div>
                            <div className="flex-1 overflow-auto">
                                {currentPageSources.map((source, idx) => (
                                    <div key={source.id} onClick={() => setSelectedSourceId(source.id)} className={`p-3 border-b cursor-pointer ${selectedSourceId === source.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{idx + 1}</span>
                                            <span className="text-sm font-medium flex-1 truncate">{source.name}</span>
                                            <span className="text-xs text-orange-500">{source.rotation}°</span>
                                            <button onClick={(e) => { e.stopPropagation(); deleteSource(source.id) }} className="text-red-500 text-sm">×</button>
                                        </div>
                                        {source.clippedImage && <img src={source.clippedImage} alt="" className="w-full rounded border" />}
                                    </div>
                                ))}
                            </div>
                        </aside>
                    </>
                )}

                {/* PREVIEW - Clean stacked layout with editable names */}
                {appState === 'preview' && (
                    <div className="flex-1 overflow-auto bg-white">
                        <div className="max-w-3xl mx-auto p-8">
                            <h1 className="text-2xl font-bold text-center mb-6 pb-4 border-b">Source Sheet</h1>

                            {sources.length === 0 ? (
                                <p className="text-center text-slate-400">No sources</p>
                            ) : (
                                <div className="space-y-6">
                                    {sources.map((source, idx) => (
                                        <div key={source.id} className="border rounded-lg overflow-hidden shadow-sm bg-white">
                                            {/* Header with controls */}
                                            <div className="bg-slate-50 px-4 py-3 flex items-center gap-3 flex-wrap">
                                                <span className="w-7 h-7 bg-blue-600 text-white text-sm font-bold rounded-full flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                                                <input
                                                    type="text"
                                                    value={source.name}
                                                    onChange={(e) => updateSourceName(source.id, e.target.value)}
                                                    className="flex-1 min-w-[150px] bg-white px-2 py-1 rounded border focus:border-blue-500 focus:outline-none text-sm"
                                                    placeholder="Source name..."
                                                />
                                                {/* Rotation */}
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-slate-500">Rotate:</span>
                                                    <input
                                                        type="number"
                                                        value={source.rotation}
                                                        onChange={(e) => updateSourceRotation(source.id, parseInt(e.target.value) || 0)}
                                                        className="w-14 text-xs px-2 py-1 border rounded text-center"
                                                        min="-180"
                                                        max="180"
                                                    />
                                                    <span className="text-xs text-slate-500">°</span>
                                                </div>
                                                <button onClick={() => deleteSource(source.id)} className="text-red-500 hover:bg-red-100 rounded p-1.5 text-xs">✕</button>
                                            </div>

                                            {/* Size Slider */}
                                            <div className="px-4 py-2 bg-slate-100 flex items-center gap-3">
                                                <span className="text-xs text-slate-600 whitespace-nowrap">Display Size:</span>
                                                <input
                                                    type="range"
                                                    min="25"
                                                    max="100"
                                                    step="5"
                                                    value={source.displaySize}
                                                    onChange={(e) => updateSourceDisplaySize(source.id, parseInt(e.target.value))}
                                                    className="flex-1 h-1.5 bg-slate-300 rounded-full appearance-none cursor-pointer"
                                                />
                                                <span className="text-xs text-slate-600 font-medium w-10 text-right">{source.displaySize}%</span>
                                            </div>

                                            {/* Image Preview at scaled size */}
                                            {source.clippedImage ? (
                                                <div className="p-4 bg-slate-50 flex justify-center">
                                                    <img
                                                        src={source.clippedImage}
                                                        alt={source.name}
                                                        style={{ width: `${source.displaySize}%`, maxWidth: '100%' }}
                                                        className="border rounded shadow-sm"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="h-24 bg-slate-100 flex items-center justify-center text-slate-400 text-sm">No preview</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* APPLY TO SHIUR */}
                            {sources.length > 0 && (
                                <div className="mt-8 p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg border">
                                    <h2 className="font-semibold mb-3 text-sm flex items-center gap-2">
                                        <span>📎</span> Attach to Shiur
                                    </h2>
                                    <div className="space-y-2">
                                        <select
                                            value={selectedShiurId || ''}
                                            onChange={(e) => setSelectedShiurId(e.target.value || null)}
                                            className="w-full px-3 py-2.5 border rounded-lg text-sm bg-white"
                                            disabled={loadingShiurim || saving}
                                        >
                                            <option value="">-- Select a Shiur --</option>
                                            {shiurim.map(s => (
                                                <option key={s.id} value={s.id}>{s.title.substring(0, 50)}{s.title.length > 50 ? '...' : ''}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={applyToShiur}
                                            disabled={!selectedShiurId || saving}
                                            className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
                                        >
                                            {saving ? '⏳ Saving...' : '✓ Apply to Shiur'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
