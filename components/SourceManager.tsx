'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, FileText, Loader2, Check, Trash2, Save, BookOpen, ChevronDown, Plus, X, Edit2 } from 'lucide-react'

interface ParsedSource {
    id: string
    text: string
    type: 'hebrew' | 'english'
    title?: string
}

interface Shiur {
    id: string
    title: string
}

export default function SourceManager() {
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [sources, setSources] = useState<ParsedSource[]>([])
    const [rawText, setRawText] = useState('')
    const [shiurim, setShiurim] = useState<Shiur[]>([])
    const [selectedShiur, setSelectedShiur] = useState<string>('')
    const [editingId, setEditingId] = useState<string | null>(null)

    // Fetch shiurim for assignment
    useEffect(() => {
        fetchShiurim()
    }, [])

    const fetchShiurim = async () => {
        try {
            const res = await fetch('/api/shiurim')
            const data = await res.json() as Shiur[]
            setShiurim(data)
        } catch (e) {
            console.error('Failed to fetch shiurim:', e)
        }
    }

    const isValidFile = (f: File) => {
        return f.type === 'application/pdf' || f.type.startsWith('image/')
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile && isValidFile(selectedFile)) {
            setFile(selectedFile)
            setSources([])
            setRawText('')
        }
    }

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile && isValidFile(droppedFile)) {
            setFile(droppedFile)
            setSources([])
            setRawText('')
        }
    }, [])

    const processFile = async () => {
        if (!file) return

        setIsProcessing(true)

        try {
            let filesToProcess: { blob: Blob; name: string }[] = []

            if (file.type === 'application/pdf') {
                // Convert PDF pages to images first (Client-side)
                const images = await convertPdfToImages(file)
                filesToProcess = images.map((blob, i) => ({ blob, name: `page-${i + 1}.png` }))
                console.log(`Converted PDF to ${images.length} images`)
            } else {
                // Direct image
                filesToProcess = [{ blob: file, name: file.name }]
            }

            let allText = ''
            let allSources: ParsedSource[] = []

            for (let i = 0; i < filesToProcess.length; i++) {
                const { blob, name } = filesToProcess[i]
                console.log(`Processing ${name} (${i + 1}/${filesToProcess.length})`)

                const formData = new FormData()
                formData.append('file', blob, name)

                const res = await fetch('/api/sources/parse', {
                    method: 'POST',
                    body: formData
                })

                const data = await res.json() as {
                    success: boolean
                    rawText: string
                    sources: ParsedSource[]
                    error?: string
                }

                if (data.success) {
                    allText += data.rawText + '\n\n'
                    allSources = [...allSources, ...data.sources]
                } else {
                    console.error('Error processing page:', data.error)
                }
            }

            setRawText(allText.trim())
            setSources(allSources)

            if (allSources.length === 0) {
                alert('No text was found. The scan may be too blurry, or try adding sources manually.')
            }
        } catch (e) {
            console.error('Processing error:', e)
            alert('Failed to process file: ' + (e as Error).message)
        } finally {
            setIsProcessing(false)
        }
    }

    // Convert PDF to images using pdf.js (runs in browser)
    const convertPdfToImages = async (pdfFile: File): Promise<Blob[]> => {
        const pdfjsLib = await import('pdfjs-dist')
        // Use local worker file from public folder
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        const arrayBuffer = await pdfFile.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        const images: Blob[] = []
        const scale = 2.0 // High quality for OCR

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum)
            const viewport = page.getViewport({ scale })

            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height

            // Use 'any' type to bypass TypeScript error for missing canvas property
            const context = canvas.getContext('2d')!
            await page.render({ canvasContext: context, viewport, canvas } as any).promise

            const blob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((b) => resolve(b!), 'image/png', 0.95)
            })
            images.push(blob)
        }

        return images
    }

    const addManualSource = () => {
        const newSource: ParsedSource = {
            id: crypto.randomUUID(),
            text: '',
            type: 'hebrew',
            title: `Source ${sources.length + 1}`
        }
        setSources([...sources, newSource])
        setEditingId(newSource.id)
    }

    const updateSource = (id: string, updates: Partial<ParsedSource>) => {
        setSources(sources.map(s => s.id === id ? { ...s, ...updates } : s))
    }

    const removeSource = (id: string) => {
        setSources(sources.filter(s => s.id !== id))
    }

    const moveSource = (index: number, direction: 'up' | 'down') => {
        const newSources = [...sources]
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= sources.length) return
        [newSources[index], newSources[newIndex]] = [newSources[newIndex], newSources[index]]
        setSources(newSources)
    }

    const generateHTML = () => {
        const html = sources.map((source, i) => {
            const dir = source.type === 'hebrew' ? 'rtl' : 'ltr'
            const align = source.type === 'hebrew' ? 'right' : 'left'
            return `
<div class="source" style="margin-bottom: 24px; padding: 16px; border-radius: 8px; background: #f8f9fa; border-left: 4px solid #1a365d;">
  ${source.title ? `<h3 style="margin: 0 0 8px 0; color: #1a365d; font-size: 14px; font-weight: 600;">${source.title}</h3>` : ''}
  <p style="margin: 0; direction: ${dir}; text-align: ${align}; font-family: 'David Libre', 'Times New Roman', serif; font-size: 18px; line-height: 1.8;">
    ${source.text}
  </p>
</div>`
        }).join('\n')

        return `<div class="sources-container" style="font-family: system-ui, sans-serif;">\n${html}\n</div>`
    }

    const copyHTML = () => {
        navigator.clipboard.writeText(generateHTML())
        alert('HTML copied to clipboard!')
    }

    const saveToShiur = async () => {
        if (!selectedShiur) {
            alert('Please select a shiur')
            return
        }

        const html = generateHTML()

        try {
            const res = await fetch(`/api/shiurim/${selectedShiur}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceDoc: html })
            })

            if (res.ok) {
                alert('Sources saved to shiur!')
            } else {
                alert('Failed to save sources')
            }
        } catch (e) {
            alert('Error saving sources')
        }
    }

    return (
        <div className="space-y-8">
            {/* Upload Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary" />
                    Upload Source Sheet
                </h3>

                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${file ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-primary hover:bg-gray-50'}`}
                    onClick={() => document.getElementById('pdf-input')?.click()}
                >
                    <input
                        id="pdf-input"
                        type="file"
                        accept=".pdf,image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {file ? (
                        <div className="flex items-center justify-center gap-3">
                            <FileText className="w-8 h-8 text-green-600" />
                            <div className="text-left">
                                <p className="font-medium text-green-800">{file.name}</p>
                                <p className="text-sm text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                className="ml-4 p-1 hover:bg-green-100 rounded"
                            >
                                <X className="w-5 h-5 text-green-600" />
                            </button>
                        </div>
                    ) : (
                        <div>
                            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 font-medium">Drop your PDF or image here</p>
                            <p className="text-sm text-gray-500 mt-1">Supports PDFs and images (JPG, PNG)</p>
                        </div>
                    )}
                </div>

                {file && (
                    <div className="mt-4">
                        <button
                            onClick={processFile}
                            disabled={isProcessing}
                            className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Extracting text with Hebrew OCR...
                                </>
                            ) : (
                                <>
                                    <FileText className="w-5 h-5" />
                                    Extract Sources (Hebrew OCR)
                                </>
                            )}
                        </button>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                            Uses Google Cloud Vision with Hebrew language support
                        </p>
                    </div>
                )}

                {/* Paste Text Alternative */}
                <details className="mt-4 border-t pt-4">
                    <summary className="cursor-pointer text-sm font-medium text-primary hover:text-primary/80">
                        📋 Or paste text directly (most reliable)
                    </summary>
                    <div className="mt-3 space-y-3">
                        <p className="text-xs text-gray-500">
                            Copy text from your source sheet and paste it below. Each paragraph becomes a separate source.
                        </p>
                        <textarea
                            placeholder="Paste your source text here..."
                            className="w-full h-48 p-3 border border-gray-300 rounded-lg font-serif text-base resize-none focus:ring-2 focus:ring-primary"
                            dir="auto"
                            onChange={(e) => setRawText(e.target.value)}
                            value={rawText}
                        />
                        <button
                            onClick={() => {
                                if (rawText.trim()) {
                                    const blocks = rawText.split(/\n{2,}/).filter(b => b.trim().length > 10)
                                    const parsed = blocks.map(block => {
                                        const hebrewChars = (block.match(/[\u0590-\u05FF]/g) || []).length
                                        const total = block.length
                                        return {
                                            id: crypto.randomUUID(),
                                            text: block.trim(),
                                            type: (hebrewChars / total > 0.3 ? 'hebrew' : 'english') as 'hebrew' | 'english'
                                        }
                                    })
                                    setSources(parsed)
                                }
                            }}
                            disabled={!rawText.trim()}
                            className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            Parse Pasted Text
                        </button>
                    </div>
                </details>
            </div>

            {/* Manual Add Section */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Sources ({sources.length})
                </h3>
                <button
                    onClick={addManualSource}
                    className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Manually
                </button>
            </div>

            {/* Sources List */}
            {
                sources.length > 0 && (
                    <div className="space-y-4">
                        {sources.map((source, index) => (
                            <div
                                key={source.id}
                                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                                        <span className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm">
                                            {index + 1}
                                        </span>
                                        <div className="flex flex-col gap-0.5">
                                            <button
                                                onClick={() => moveSource(index, 'up')}
                                                disabled={index === 0}
                                                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                            >
                                                ▲
                                            </button>
                                            <button
                                                onClick={() => moveSource(index, 'down')}
                                                disabled={index === sources.length - 1}
                                                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                            >
                                                ▼
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3">
                                        {/* Title */}
                                        <input
                                            type="text"
                                            value={source.title || ''}
                                            onChange={(e) => updateSource(source.id, { title: e.target.value })}
                                            placeholder="Source title (e.g., רמב״ם הלכות תשובה פ״א ה״א)"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary focus:border-primary"
                                        />

                                        {/* Content */}
                                        {editingId === source.id ? (
                                            <textarea
                                                value={source.text}
                                                onChange={(e) => updateSource(source.id, { text: e.target.value })}
                                                className="w-full h-40 px-3 py-2 border border-gray-200 rounded-lg font-serif text-lg leading-relaxed resize-none focus:ring-2 focus:ring-primary"
                                                dir="auto"
                                                autoFocus
                                                onBlur={() => setEditingId(null)}
                                            />
                                        ) : (
                                            <div
                                                onClick={() => setEditingId(source.id)}
                                                className={`p-4 bg-gray-50 rounded-lg font-serif text-lg leading-relaxed cursor-text min-h-[80px] hover:bg-gray-100 transition-colors
                        ${source.type === 'hebrew' ? 'text-right' : 'text-left'}`}
                                                dir={source.type === 'hebrew' ? 'rtl' : 'ltr'}
                                            >
                                                {source.text || <span className="text-gray-400 italic">Click to add text...</span>}
                                            </div>
                                        )}

                                        {/* Type Toggle & Actions */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => updateSource(source.id, { type: 'hebrew' })}
                                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors
                          ${source.type === 'hebrew' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                >
                                                    עברית
                                                </button>
                                                <button
                                                    onClick={() => updateSource(source.id, { type: 'english' })}
                                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors
                          ${source.type === 'english' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                >
                                                    English
                                                </button>
                                            </div>

                                            <button
                                                onClick={() => removeSource(source.id)}
                                                className="text-red-500 hover:text-red-700 p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }

            {/* Empty State */}
            {
                sources.length === 0 && !file && (
                    <div className="text-center py-12 text-gray-500">
                        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No sources yet</p>
                        <p className="text-sm">Upload a PDF or add sources manually</p>
                    </div>
                )
            }

            {/* Actions */}
            {
                sources.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Save className="w-5 h-5 text-primary" />
                            Save Sources
                        </h3>

                        <div className="grid md:grid-cols-2 gap-4">
                            {/* Assign to Shiur */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Assign to Shiur</label>
                                <select
                                    value={selectedShiur}
                                    onChange={(e) => setSelectedShiur(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary"
                                >
                                    <option value="">Select a shiur...</option>
                                    {shiurim.map(s => (
                                        <option key={s.id} value={s.id}>{s.title}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={saveToShiur}
                                    disabled={!selectedShiur}
                                    className="w-full py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save to Shiur
                                </button>
                            </div>

                            {/* Copy HTML */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Export</label>
                                <button
                                    onClick={copyHTML}
                                    className="w-full py-2 border border-primary text-primary rounded-lg font-medium hover:bg-primary/5 flex items-center justify-center gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    Copy as HTML
                                </button>
                                <p className="text-xs text-gray-500">Copy formatted HTML to use elsewhere</p>
                            </div>
                        </div>

                        {/* Preview */}
                        <details className="mt-4">
                            <summary className="cursor-pointer text-sm font-medium text-primary hover:text-primary/80">
                                Preview HTML Output
                            </summary>
                            <div className="mt-3 p-4 bg-gray-50 rounded-lg overflow-auto max-h-96">
                                <div dangerouslySetInnerHTML={{ __html: generateHTML() }} />
                            </div>
                        </details>
                    </div>
                )
            }
        </div >
    )
}
