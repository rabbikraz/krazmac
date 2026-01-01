'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, Loader2, RefreshCw, X, Save, Plus, Trash2, Layout, ScanLine } from 'lucide-react'
import ReactCrop, { Crop, PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface Source {
    id: string
    title: string
    pageIndex: number
    crop: PercentCrop
}

export default function SourceManager() {
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [sources, setSources] = useState<Source[]>([])
    const [pageImages, setPageImages] = useState<string[]>([])

    // Simple state: Just one active source being edited (optional)
    const [editingSourceId, setEditingSourceId] = useState<string | null>(null)

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f) {
            setFile(f)
            processFile(f) // Auto-start
        }
    }, [])

    const processFile = async (f: File) => {
        setIsProcessing(true)
        setSources([])
        setPageImages([])

        try {
            // 1. Convert PDF to Images
            let images: File[] = []
            if (f.type === 'application/pdf') {
                images = await pdfToImages(f)
            } else {
                images = [f]
            }

            const newPageImages: string[] = []
            const newSources: Source[] = []

            // 2. Process ALL pages
            for (let i = 0; i < images.length; i++) {
                const imageUrl = await fileToBase64(images[i])
                newPageImages.push(imageUrl)

                // 3. AI Analysis
                const formData = new FormData()
                formData.append('file', images[i])

                try {
                    const res = await fetch('/api/sources/parse', { method: 'POST', body: formData })
                    const data = await res.json() as { success: boolean; regions: any[]; image: string }

                    if (data.success && data.regions) {
                        data.regions.forEach((r: any, idx: number) => {
                            // Convert standard [ymin, xmin, ymax, xmax] (0-1000) to %
                            const [ymin, xmin, ymax, xmax] = r.box_2d || [r.y * 10, 0, (r.y + r.height) * 10, 1000]

                            newSources.push({
                                id: crypto.randomUUID(),
                                title: r.title || `Source ${newSources.length + 1}`,
                                pageIndex: i,
                                crop: {
                                    unit: '%',
                                    x: xmin / 10,
                                    y: ymin / 10,
                                    width: (xmax - xmin) / 10,
                                    height: (ymax - ymin) / 10
                                }
                            })
                        })
                    }
                } catch (e) {
                    console.error('AI Error', e)
                }
            }

            setPageImages(newPageImages)
            setSources(newSources)

        } catch (e) {
            alert('Error processing file: ' + e)
        } finally {
            setIsProcessing(false)
        }
    }

    const onUpdateCrop = (id: string, c: PercentCrop) => {
        setSources(sources.map(s => s.id === id ? { ...s, crop: c } : s))
    }

    // --- Helpers ---
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

    return (
        <div className="max-w-4xl mx-auto p-6 font-sans text-sm">
            {/* Header / Upload */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Source Extraction</h1>
                    <p className="text-gray-500 text-xs mt-1">AI-Powered Source Sheet Parser</p>
                </div>

                {file && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => processFile(file)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs font-medium"
                        >
                            <RefreshCw className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} /> Re-Run
                        </button>
                        <button
                            onClick={() => { setFile(null); setSources([]); setPageImages([]); }}
                            className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded text-xs font-medium ml-2"
                        >
                            Reset
                        </button>
                    </div>
                )}
            </div>

            {/* Empty State */}
            {!file && (
                <div
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => document.getElementById('uploader')?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all group"
                >
                    <div className="bg-blue-50 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">Upload Source Sheet</h3>
                    <p className="text-gray-400 text-xs mt-1">PDFs or Images supported</p>
                    <input
                        id="uploader"
                        type="file"
                        className="hidden"
                        accept=".pdf,image/*"
                        onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) {
                                setFile(f)
                                processFile(f)
                            }
                        }}
                    />
                </div>
            )}

            {/* Processing */}
            {isProcessing && (
                <div className="text-center py-12 animate-pulse">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                    <p className="text-gray-500 font-medium text-xs">Scanning layout...</p>
                </div>
            )}

            {/* Results Grid */}
            {!isProcessing && pageImages.length > 0 && (
                <div className="space-y-8 relative z-0">
                    {pageImages.map((img, pageIdx) => (
                        <div key={pageIdx} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-3 py-2 border-b flex justify-between items-center">
                                <span className="font-semibold text-gray-700 text-xs">Page {pageIdx + 1}</span>
                                <span className="text-[10px] text-gray-400 uppercase tracking-wider">{sources.filter(s => s.pageIndex === pageIdx).length} sources</span>
                            </div>

                            <div className="relative">
                                {/* Base Image */}
                                <img src={img} className="w-full block" />

                                {/* Overlays */}
                                {sources.filter(s => s.pageIndex === pageIdx).map(source => (
                                    <div
                                        key={source.id}
                                        className="absolute group z-10"
                                        style={{
                                            left: `${source.crop.x}%`,
                                            top: `${source.crop.y}%`,
                                            width: `${source.crop.width}%`,
                                            height: `${source.crop.height}%`,
                                        }}
                                    >
                                        <div
                                            className="w-full h-full border border-blue-400 bg-blue-500/5 hover:bg-blue-500/10 cursor-pointer relative transition-all"
                                            onClick={() => setEditingSourceId(source.id)}
                                        >
                                            <div className="absolute top-0 left-0 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-br shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                {source.title}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Floating Save Button */}
                    <div className="flex justify-center pt-4 pb-12 sticky bottom-0 pointer-events-none">
                        <button className="pointer-events-auto px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition-all flex items-center gap-2">
                            <Save className="w-4 h-4" /> Save All
                        </button>
                    </div>

                    {/* Edit Modal (Compact) */}
                    {editingSourceId && (() => {
                        const source = sources.find(s => s.id === editingSourceId)
                        if (!source) return null
                        const img = pageImages[source.pageIndex]

                        return (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                                <div className="bg-white rounded-xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                                    <div className="p-3 border-b flex justify-between items-center bg-gray-50">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="font-bold">Edit Source</span>
                                            <span className="text-gray-400 px-2 py-0.5 bg-gray-100 rounded text-xs">{source.title}</span>
                                        </div>
                                        <button onClick={() => setEditingSourceId(null)} className="p-1.5 hover:bg-gray-200 rounded-full"><X className="w-4 h-4" /></button>
                                    </div>

                                    <div className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center">
                                        <ReactCrop
                                            crop={source.crop}
                                            onChange={(_, p) => onUpdateCrop(source.id, p)}
                                            className="shadow-sm bg-white"
                                        >
                                            <img src={img} className="max-h-[60vh] object-contain block" />
                                        </ReactCrop>
                                    </div>

                                    <div className="p-3 border-t bg-gray-50 flex justify-between gap-3 text-xs">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setSources(sources.filter(s => s.id !== editingSourceId))
                                                    setEditingSourceId(null)
                                                }}
                                                className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded font-medium flex items-center gap-1.5 border border-transparent hover:border-red-100"
                                            >
                                                <Trash2 className="w-3 h-3" /> Delete
                                            </button>

                                            <button
                                                onClick={() => {
                                                    const s = sources.find(x => x.id === editingSourceId)
                                                    if (!s) return
                                                    const halfH = s.crop.height / 2
                                                    const updated = { ...s, crop: { ...s.crop, height: halfH }, title: s.title + ' (1)' }
                                                    const newSrc: Source = {
                                                        id: crypto.randomUUID(),
                                                        title: s.title + ' (2)',
                                                        pageIndex: s.pageIndex,
                                                        crop: { ...s.crop, y: s.crop.y + halfH, height: halfH }
                                                    }
                                                    setSources(prev => {
                                                        const idx = prev.findIndex(p => p.id === editingSourceId)
                                                        const next = [...prev]
                                                        next[idx] = updated
                                                        next.splice(idx + 1, 0, newSrc)
                                                        return next
                                                    })
                                                }}
                                                className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded font-medium flex items-center gap-1.5"
                                            >
                                                <ScanLine className="w-3 h-3" /> Split Box
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => setEditingSourceId(null)}
                                            className="bg-blue-600 text-white px-6 py-1.5 rounded font-bold hover:bg-blue-700 shadow-sm"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            )}
        </div>
    )
}
