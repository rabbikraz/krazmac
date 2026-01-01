'use client'

import { useState, useCallback } from 'react'
import { Upload, Loader2, Trash2, Plus } from 'lucide-react'

interface Source {
    id: string
    title: string
    imageUrl: string  // Full page image
    cropY: number     // % from top
    cropHeight: number // % height
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

            const res = await fetch('/api/sources/parse', {
                method: 'POST',
                body: formData
            })

            const data = await res.json() as { success: boolean; regions: any[]; image: string; error?: string }

            if (data.success) {
                setPageImage(data.image)
                setSources(data.regions.map((r: any, i: number) => ({
                    id: crypto.randomUUID(),
                    title: r.title || `Source ${i + 1}`,
                    imageUrl: data.image,
                    cropY: r.y || 0,
                    cropHeight: r.height || 20
                })))
            } else {
                alert(data.error || 'Failed to process')
            }
        } catch (e) {
            alert('Error: ' + e)
        } finally {
            setIsProcessing(false)
        }
    }

    // Convert PDF to image using canvas
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

    const deleteSource = (id: string) => {
        setSources(sources.filter(s => s.id !== id))
    }

    const addManualSource = () => {
        if (!pageImage) return alert('Upload a file first')
        setSources([...sources, {
            id: crypto.randomUUID(),
            title: `Source ${sources.length + 1}`,
            imageUrl: pageImage,
            cropY: 0,
            cropHeight: 100
        }])
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold">Source Manager</h1>

            {/* Upload Area */}
            <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors"
            >
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Drop PDF or image here</p>
                <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
                    className="hidden"
                    id="file-input"
                />
                <label htmlFor="file-input" className="text-blue-600 hover:underline cursor-pointer">
                    or click to browse
                </label>
                {file && <p className="mt-2 text-sm text-gray-500">Selected: {file.name}</p>}
            </div>

            {/* Process Button */}
            {file && (
                <button
                    onClick={processFile}
                    disabled={isProcessing}
                    className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        'Extract Sources'
                    )}
                </button>
            )}

            {/* Sources List */}
            {sources.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">{sources.length} Sources Found</h2>
                        <button
                            onClick={addManualSource}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                            <Plus className="w-4 h-4" /> Add manually
                        </button>
                    </div>

                    {sources.map((source, i) => (
                        <div key={source.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            {/* Title */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
                                <input
                                    type="text"
                                    value={source.title}
                                    onChange={e => {
                                        const updated = [...sources]
                                        updated[i].title = e.target.value
                                        setSources(updated)
                                    }}
                                    className="font-medium bg-transparent border-none focus:outline-none"
                                    placeholder="Source title..."
                                />
                                <button onClick={() => deleteSource(source.id)} className="text-red-500 hover:text-red-700">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Cropped Image */}
                            <div
                                className="relative overflow-hidden"
                                style={{
                                    height: '200px'
                                }}
                            >
                                <img
                                    src={source.imageUrl}
                                    alt={source.title}
                                    className="absolute w-full"
                                    style={{
                                        top: `-${source.cropY}%`,
                                        height: `${100 / (source.cropHeight / 100)}%`
                                    }}
                                />
                            </div>

                            {/* Crop Adjusters */}
                            <div className="p-3 bg-gray-50 border-t space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <label className="w-16">Start %:</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={source.cropY}
                                        onChange={e => {
                                            const updated = [...sources]
                                            updated[i].cropY = Number(e.target.value)
                                            setSources(updated)
                                        }}
                                        className="flex-1"
                                    />
                                    <span className="w-10">{source.cropY}%</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <label className="w-16">Height %:</label>
                                    <input
                                        type="range"
                                        min="5"
                                        max="100"
                                        value={source.cropHeight}
                                        onChange={e => {
                                            const updated = [...sources]
                                            updated[i].cropHeight = Number(e.target.value)
                                            setSources(updated)
                                        }}
                                        className="flex-1"
                                    />
                                    <span className="w-10">{source.cropHeight}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
