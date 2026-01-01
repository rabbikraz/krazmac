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

    const [editingSourceId, setEditingSourceId] = useState<string | null>(null)

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f) {
            setFile(f)
            processFile(f)
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
        <div className="max-w-5xl mx-auto p-8 font-sans">
            {/* Header / Upload */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Source Extraction</h1>
                    <p className="text-gray-500 text-sm mt-1">AI-Powered Source Sheet Parser</p>
                </div>

                {file && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => processFile(file)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                        >
                            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} /> Re-Run Analysis
                        </button>
                        <button
                            onClick={() => { setFile(null); setSources([]); setPageImages([]); }}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium ml-2"
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
                    className="border-2 border-dashed border-gray-200 rounded-2xl p-16 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all group"
                >
                    <div className="bg-blue-50 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Upload Source Sheet</h3>
                    <p className="text-gray-500 mt-2">PDFs or Images supported</p>
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
                <div className="text-center py-20 animate-pulse">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Analyzing layout & geometry...</p>
                </div>
            )}

            {/* Results Grid */}
            {!isProcessing && pageImages.length > 0 && (
                <div className="space-y-12 relative z-0">
                    {pageImages.map((img, pageIdx) => (
                        <div key={pageIdx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                                <span className="font-semibold text-gray-700 text-sm">Page {pageIdx + 1}</span>
                                <span className="text-xs text-gray-400">{sources.filter(s => s.pageIndex === pageIdx).length} sources detected</span>
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
                                            className="w-full h-full border-2 border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 cursor-pointer relative transition-all"
                                            onClick={() => setEditingSourceId(source.id)}
                                        >
                                            <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-sm whitespace-nowrap flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="font-bold">{source.title}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Floating Save Button */}
                    <div className="flex justify-end pt-8 pb-20 sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent px-4 z-10 pointer-events-none">
                        <button className="pointer-events-auto px-8 py-3 bg-blue-600 text-white font-bold rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition-all flex items-center gap-2">
                            <Save className="w-5 h-5" /> Save All to Database
                        </button>
                    </div>

                    {/* Edit Modal (Z-50) */}
                    {editingSourceId && (() => {
                        const source = sources.find(s => s.id === editingSourceId)
                        if (!source) return null
                        const img = pageImages[source.pageIndex]

                        return (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8 animate-in fade-in duration-200">
                                <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg">Edit Source</h3>
                                            <span className="text-gray-400 text-sm px-2 py-0.5 bg-gray-100 rounded">{source.title}</span>
                                        </div>
                                        <button onClick={() => setEditingSourceId(null)} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-5 h-5" /></button>
                                    </div>

                                    <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
                                        <ReactCrop
                                            crop={source.crop}
                                            onChange={(_, p) => onUpdateCrop(source.id, p)}
                                            className="shadow-lg bg-white"
                                        >
                                            <img src={img} className="max-h-[70vh] object-contain block" />
                                        </ReactCrop>
                                    </div>

                                    <div className="p-4 border-t bg-gray-50 flex justify-between gap-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setSources(sources.filter(s => s.id !== editingSourceId))
                                                    setEditingSourceId(null)
                                                }}
                                                className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium flex items-center gap-2 border border-transparent hover:border-red-100"
                                            >
                                                <Trash2 className="w-4 h-4" /> Delete
                                            </button>

                                            <button
                                                onClick={() => {
                                                    const s = sources.find(x => x.id === editingSourceId)
                                                    if (!s) return

                                                    // Split in half
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
                                                className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                                                title="Split detect region into two halves"
                                            >
                                                <ScanLine className="w-4 h-4" /> Split Box
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => setEditingSourceId(null)}
                                            className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md transform transition active:scale-95"
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
