'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, Loader2, Trash2, Plus, ArrowLeft, ArrowRight, Layers, Layout, Check, ChevronRight } from 'lucide-react'
import ReactCrop, { Crop, PixelCrop, PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface Source {
    id: string
    title: string
    pageIndex: number
    crop: PercentCrop
    imageUrl: string
}

export default function SourceManager() {
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [sources, setSources] = useState<Source[]>([])
    const [pageImages, setPageImages] = useState<string[]>([])
    const [activePage, setActivePage] = useState<number>(0)

    // Editor State
    const [activeSourceId, setActiveSourceId] = useState<string | null>(null)
    const [editorCrop, setEditorCrop] = useState<Crop>()
    const imgRef = useRef<HTMLImageElement>(null)
    const listRef = useRef<HTMLDivElement>(null)

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f) {
            setFile(f)
            setSources([])
            setPageImages([])
            setActivePage(0)
        }
    }, [])

    const processFile = async () => {
        if (!file) return
        setIsProcessing(true)

        try {
            // 1. Convert PDF/Image to Array of Images
            let images: File[] = []
            if (file.type === 'application/pdf') {
                images = await pdfToImages(file)
            } else {
                images = [file]
            }

            const newPageImages: string[] = []
            const newSources: Source[] = []

            // 2. Process each page with AI
            for (let i = 0; i < images.length; i++) {
                const imageUrl = await fileToBase64(images[i])
                newPageImages.push(imageUrl)

                const formData = new FormData()
                formData.append('file', images[i])

                try {
                    const res = await fetch('/api/sources/parse', { method: 'POST', body: formData })
                    const data = await res.json() as { success: boolean; regions: any[]; error?: string }

                    if (data.success && data.regions) {
                        data.regions.forEach((r: any, idx: number) => {
                            newSources.push({
                                id: crypto.randomUUID(),
                                title: r.title || `Source ${newSources.length + 1}`,
                                pageIndex: i,
                                imageUrl: imageUrl,
                                crop: {
                                    unit: '%',
                                    x: 0,
                                    y: r.y ?? 0,
                                    width: 100,
                                    height: r.height ?? 20
                                }
                            })
                        })
                    }
                } catch (e) {
                    console.error('AI Error:', e)
                }
            }

            setPageImages(newPageImages)
            setSources(newSources)
            if (newSources.length > 0) setActiveSourceId(newSources[0].id)

        } catch (e) {
            alert('Error: ' + e)
        } finally {
            setIsProcessing(false)
        }
    }

    const pdfToImages = async (pdfFile: File): Promise<File[]> => {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const pdf = await pdfjsLib.getDocument({ data: await pdfFile.arrayBuffer() }).promise
        const files: File[] = []

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: 2 })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas } as any).promise
            const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'))
            if (blob) files.push(new File([blob], `page-${i}.png`, { type: 'image/png' }))
        }
        return files
    }

    const fileToBase64 = (f: File) => new Promise<string>(r => {
        const reader = new FileReader(); reader.onload = () => r(reader.result as string); reader.readAsDataURL(f)
    })

    const activeSource = sources.find(s => s.id === activeSourceId)

    // Sync editor crop when switching sources
    useEffect(() => {
        if (activeSource) {
            setEditorCrop(activeSource.crop)
            setActivePage(activeSource.pageIndex)
            // Scroll list item into view
            const el = document.getElementById(`source-item-${activeSource.id}`)
            el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
    }, [activeSourceId])

    const onCropChange = (c: Crop, p: PercentCrop) => {
        setEditorCrop(p)
    }

    const onCropComplete = (c: Crop, p: PercentCrop) => {
        if (!activeSourceId) return
        setSources(sources.map(s => s.id === activeSourceId ? { ...s, crop: p } : s))
    }

    const addNewSource = () => {
        const newSrc: Source = {
            id: crypto.randomUUID(),
            title: `New Source`,
            pageIndex: activePage,
            imageUrl: pageImages[activePage],
            crop: { unit: '%', x: 5, y: 5, width: 90, height: 20 }
        }
        setSources([...sources, newSrc])
        setActiveSourceId(newSrc.id)
    }

    return (
        <div className="max-w-[1600px] mx-auto p-6 h-[90vh] flex flex-col gap-6">
            <h1 className="text-2xl font-bold text-gray-800 shrink-0">Content Extraction Studio</h1>

            <div className="flex-1 flex gap-6 min-h-0">
                {/* 1. Source List */}
                <div className="w-80 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden shrink-0">
                    <div className="p-4 border-b bg-gray-50 flex items-center justify-between shrink-0">
                        <h2 className="font-bold text-gray-700 flex items-center gap-2">
                            <Layers className="w-4 h-4" />
                            Sources ({sources.length})
                        </h2>
                        <button onClick={addNewSource} className="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition-colors">
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
                        {sources.length === 0 && !isProcessing && (
                            <div className="text-center p-8 text-gray-400 text-sm">
                                No sources yet.<br />Upload a file to begin.
                            </div>
                        )}

                        {sources.map((s, i) => (
                            <div
                                id={`source-item-${s.id}`}
                                key={s.id}
                                onClick={() => setActiveSourceId(s.id)}
                                className={`p-3 rounded-lg text-sm cursor-pointer border transition-all duration-200
                                    ${activeSourceId === s.id ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300 shadow-sm' : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`font-bold ${activeSourceId === s.id ? 'text-blue-700' : 'text-gray-500'}`}>#{i + 1}</span>
                                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-medium">Page {s.pageIndex + 1}</span>
                                </div>
                                <input
                                    value={s.title}
                                    onChange={(e) => setSources(sources.map(x => x.id === s.id ? { ...x, title: e.target.value } : x))}
                                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-gray-800 font-medium placeholder-gray-400"
                                    placeholder="Enter title..."
                                    onClick={e => e.stopPropagation()}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Main Editor Canvas */}
                <div className="flex-1 flex flex-col bg-gray-100 rounded-xl overflow-hidden relative border border-gray-300 shadow-inner">
                    {/* Upload Overlay */}
                    {!file && (
                        <div
                            onDrop={handleDrop}
                            onDragOver={e => e.preventDefault()}
                            className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => document.getElementById('finput')?.click()}
                        >
                            <div className="bg-blue-50 p-6 rounded-full mb-4">
                                <Upload className="w-12 h-12 text-blue-500" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Upload PDF or Image</h3>
                            <p className="text-gray-500 font-medium">Drag & drop or click to browse</p>
                            <input id="finput" type="file" className="hidden" accept=".pdf,image/*" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
                        </div>
                    )}

                    {/* Loader */}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-white/90 z-30 flex flex-col items-center justify-center backdrop-blur-sm">
                            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                            <h3 className="text-lg font-bold text-gray-800">Analyzing Document Structure...</h3>
                            <p className="text-gray-500">AI is identifying source boundaries.</p>
                        </div>
                    )}

                    {/* Toolbar */}
                    {file && (
                        <div className="h-14 bg-white border-b flex items-center justify-between px-6 z-10 shrink-0 shadow-sm">
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-gray-700 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-gray-400" />
                                    Page {activePage + 1} <span className="text-gray-400 font-normal">of {pageImages.length}</span>
                                </span>
                                <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                                    <button
                                        onClick={() => setActivePage(Math.max(0, activePage - 1))}
                                        disabled={activePage === 0}
                                        className="p-1.5 hover:bg-white rounded-md disabled:opacity-30 transition-all"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setActivePage(Math.min(pageImages.length - 1, activePage + 1))}
                                        disabled={activePage === pageImages.length - 1}
                                        className="p-1.5 hover:bg-white rounded-md disabled:opacity-30 transition-all"
                                    >
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={processFile} className="px-4 py-1.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors shadow-sm">
                                    Re-Run AI
                                </button>
                                <button onClick={() => setFile(null)} className="px-4 py-1.5 text-red-600 text-sm font-medium hover:bg-red-50 rounded-lg transition-colors">
                                    Close File
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Editor Area */}
                    <div className="flex-1 overflow-auto p-8 flex justify-center items-start bg-slate-100/50">
                        {pageImages[activePage] && (
                            <div className="relative shadow-2xl bg-white ring-1 ring-gray-900/5">
                                {activeSourceId && activeSource?.pageIndex === activePage ? (
                                    <ReactCrop
                                        crop={editorCrop}
                                        onChange={onCropChange}
                                        onComplete={onCropComplete}
                                        className="max-h-[75vh]"
                                        keepSelection
                                    >
                                        <img
                                            ref={imgRef}
                                            src={pageImages[activePage]}
                                            className="max-h-[75vh] object-contain block select-none"
                                            onLoad={(e) => {
                                                // Reset crop if invalid
                                            }}
                                        />
                                    </ReactCrop>
                                ) : (
                                    <div className="relative cursor-crosshair">
                                        <img
                                            src={pageImages[activePage]}
                                            className="max-h-[75vh] object-contain block select-none"
                                        />
                                        {sources.filter(s => s.pageIndex === activePage).map(s => (
                                            <div
                                                key={s.id}
                                                onClick={(e) => { e.stopPropagation(); setActiveSourceId(s.id); }}
                                                className="absolute border-2 border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 transition-colors z-10 group"
                                                style={{
                                                    left: s.crop.x + '%',
                                                    top: s.crop.y + '%',
                                                    width: s.crop.width + '%',
                                                    height: s.crop.height + '%'
                                                }}
                                            >
                                                <span className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-sm">
                                                    {s.title}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Validation / Preview Column */}
                <div className="w-96 flex flex-col bg-white border border-gray-200 rounded-xl p-5 shadow-sm shrink-0">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Layout className="w-5 h-5 text-gray-500" />
                        Details & Preview
                    </h3>

                    {activeSource ? (
                        <div className="flex-1 flex flex-col min-h-0 space-y-4">
                            {/* Scrollable Preview Area */}
                            <div className="bg-gray-50 rounded-lg border border-gray-200 flex-1 overflow-auto relative min-h-[300px] shadow-inner">
                                <div className="w-full relative bg-white">
                                    <div style={{ paddingBottom: `${(activeSource.crop.height / activeSource.crop.width) * 100}%` }}></div>
                                    <img
                                        src={pageImages[activeSource.pageIndex]}
                                        className="absolute top-0 left-0 max-w-none origin-top-left select-none"
                                        style={{
                                            width: `${100 / (activeSource.crop.width / 100)}%`,
                                            left: `-${activeSource.crop.x * (100 / activeSource.crop.width)}%`,
                                            top: `-${activeSource.crop.y * (100 / activeSource.crop.width)}%`
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <div>
                                        <span className="block font-semibold text-gray-700">Position</span>
                                        X: {Math.round(activeSource.crop.x)}% <br />
                                        Y: {Math.round(activeSource.crop.y)}%
                                    </div>
                                    <div>
                                        <span className="block font-semibold text-gray-700">Dimensions</span>
                                        W: {Math.round(activeSource.crop.width)}% <br />
                                        H: {Math.round(activeSource.crop.height)}%
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        const idx = sources.findIndex(s => s.id === activeSourceId)
                                        const next = sources[idx + 1]
                                        if (next) setActiveSourceId(next.id)
                                    }}
                                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm flex items-center justify-center gap-2"
                                >
                                    Confirm & Next <ChevronRight className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => {
                                        const newSrcs = sources.filter(s => s.id !== activeSourceId)
                                        setSources(newSrcs)
                                        setActiveSourceId(newSrcs[0]?.id || null)
                                    }}
                                    className="w-full py-2.5 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors"
                                >
                                    Delete Source
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm">
                            <Layers className="w-12 h-12 mb-3 text-gray-200" />
                            <p>Select a source to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
