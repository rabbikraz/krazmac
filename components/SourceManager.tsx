'use client'

import { useState, useCallback } from 'react'
import { Upload, Loader2, Trash2, Plus, Scissors } from 'lucide-react'

interface Source {
    id: string
    title: string
    y: number       // % from top
    height: number  // % height
}

export default function SourceManager() {
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [sources, setSources] = useState<Source[]>([])
    const [pageImage, setPageImage] = useState<string>('')

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const f = e.dataTransfer.files[0]
        if (f && (f.type === 'application/pdf' || f.type.startsWith('image/'))) {
            setFile(f)
            setSources([])
            setPageImage('')
        }
    }, [])

    const processFile = async () => {
        if (!file) return
        setIsProcessing(true)

        try {
            // If PDF, convert to image first
            let imageFile = file
            if (file.type === 'application/pdf') {
                imageFile = await pdfToImage(file)
            }

            // Send to API
            const formData = new FormData()
            formData.append('file', imageFile)

            const res = await fetch('/api/sources/parse', { method: 'POST', body: formData })
            const data = await res.json() as { success: boolean; image: string; regions: any[]; error?: string }

            if (data.success && data.image) {
                setPageImage(data.image)
                setSources(data.regions.map((r: any, i: number) => ({
                    id: crypto.randomUUID(),
                    title: r.title || `Source ${i + 1}`,
                    y: r.y ?? 0,
                    height: r.height ?? 100
                })))
            } else {
                alert(data.error || 'Failed')
            }
        } catch (e) {
            console.error(e)
            alert('Error processing file')
        } finally {
            setIsProcessing(false)
        }
    }

    const pdfToImage = async (pdfFile: File): Promise<File> => {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const buffer = await pdfFile.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
        const page = await pdf.getPage(1)

        const scale = 2
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({
            canvasContext: canvas.getContext('2d')!,
            viewport,
            canvas
        } as any).promise

        return new Promise(resolve => {
            canvas.toBlob(blob => {
                resolve(new File([blob!], 'page.png', { type: 'image/png' }))
            }, 'image/png')
        })
    }

    const deleteSource = (id: string) => setSources(sources.filter(s => s.id !== id))

    const splitSource = (id: string) => {
        const idx = sources.findIndex(s => s.id === id)
        if (idx === -1) return

        const source = sources[idx]
        const half = source.height / 2

        const newSources = [...sources]
        newSources[idx] = { ...source, height: half }
        newSources.splice(idx + 1, 0, {
            id: crypto.randomUUID(),
            title: `Source ${sources.length + 1}`,
            y: source.y + half,
            height: half
        })
        setSources(newSources)
    }

    const updateSource = (id: string, field: 'y' | 'height' | 'title', value: number | string) => {
        setSources(sources.map(s => s.id === id ? { ...s, [field]: value } : s))
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold">Source Manager</h1>
            <p className="text-gray-600">Upload a PDF or image, then manually adjust the crop regions for each source.</p>

            {/* Upload Area */}
            <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-input')?.click()}
            >
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Drop PDF or image here, or click to browse</p>
                <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }}
                    className="hidden"
                    id="file-input"
                />
                {file && <p className="mt-2 font-medium text-blue-600">{file.name}</p>}
            </div>

            {/* Process Button */}
            {file && !pageImage && (
                <button
                    onClick={processFile}
                    disabled={isProcessing}
                    className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Converting...</>
                    ) : (
                        'Load Image'
                    )}
                </button>
            )}

            {/* Full Page Preview */}
            {pageImage && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Page Preview</h2>
                        <button
                            onClick={() => { setPageImage(''); setSources([]); setFile(null) }}
                            className="text-sm text-red-600 hover:underline"
                        >
                            Clear & Start Over
                        </button>
                    </div>
                    <div className="relative border rounded-lg overflow-hidden bg-gray-100">
                        <img src={pageImage} alt="Full page" className="w-full" />
                        {/* Overlay showing crop regions */}
                        <div className="absolute inset-0 pointer-events-none">
                            {sources.map((s, i) => (
                                <div
                                    key={s.id}
                                    className="absolute left-0 right-0 border-2 border-blue-500 bg-blue-500/10"
                                    style={{ top: `${s.y}%`, height: `${s.height}%` }}
                                >
                                    <span className="absolute top-1 left-2 text-xs font-bold text-blue-700 bg-white px-1 rounded">
                                        {i + 1}: {s.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Sources List */}
            {sources.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">{sources.length} Source(s)</h2>
                        <button
                            onClick={() => setSources([...sources, {
                                id: crypto.randomUUID(),
                                title: `Source ${sources.length + 1}`,
                                y: 0,
                                height: 20
                            }])}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                            <Plus className="w-4 h-4" /> Add Source
                        </button>
                    </div>

                    {sources.map((source, i) => (
                        <div key={source.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            {/* Header */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-500">#{i + 1}</span>
                                    <input
                                        type="text"
                                        value={source.title}
                                        onChange={e => updateSource(source.id, 'title', e.target.value)}
                                        className="font-medium bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                                        placeholder="Source title..."
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => splitSource(source.id)} title="Split in half" className="text-blue-500 hover:text-blue-700">
                                        <Scissors className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => deleteSource(source.id)} className="text-red-500 hover:text-red-700">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Cropped Preview */}
                            {pageImage && (
                                <div className="relative overflow-hidden h-40 bg-gray-50">
                                    <img
                                        src={pageImage}
                                        alt={source.title}
                                        className="absolute w-full"
                                        style={{
                                            top: `${-source.y * 100 / source.height}%`,
                                            height: `${10000 / source.height}%`
                                        }}
                                    />
                                </div>
                            )}

                            {/* Sliders */}
                            <div className="p-3 bg-gray-50 border-t grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <label className="text-gray-600">Start: {source.y}%</label>
                                    <input
                                        type="range" min="0" max="99"
                                        value={source.y}
                                        onChange={e => updateSource(source.id, 'y', Number(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-600">Height: {source.height}%</label>
                                    <input
                                        type="range" min="1" max="100"
                                        value={source.height}
                                        onChange={e => updateSource(source.id, 'height', Number(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
