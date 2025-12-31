'use client'

import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { createWorker } from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import { Loader2, Upload, FileText, Search, Book, ExternalLink, Check, AlertCircle } from 'lucide-react'

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

interface ScannedSource {
    id: string
    originalText: string
    cleanedText: string
    sefariaRef?: string
    sefariaData?: any
    hebrewBooksId?: string
    confidence: number
}

export default function SourceManager() {
    const [status, setStatus] = useState<'idle' | 'processing' | 'analyzing' | 'complete'>('idle')
    const [progress, setProgress] = useState(0)
    const [statusMessage, setStatusMessage] = useState('')
    const [sources, setSources] = useState<ScannedSource[]>([])
    const [rawText, setRawText] = useState('')

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return

        const file = acceptedFiles[0]
        setStatus('processing')
        setProgress(0)
        setStatusMessage('Initializing OCR engine...')
        setSources([])
        setRawText('')

        try {
            const worker = await createWorker('eng+heb')
            setStatusMessage('Scanning document...')

            let text = ''

            if (file.type === 'application/pdf') {
                text = await extractTextFromPdf(file, worker)
            } else {
                const { data } = await worker.recognize(file)
                text = data.text
            }

            await worker.terminate()
            setRawText(text)
            setStatus('analyzing')
            analyzeText(text)

        } catch (error) {
            console.error('OCR Error:', error)
            setStatusMessage('Error scanning document. Please try again.')
            setStatus('idle')
        }
    }, [])

    const extractTextFromPdf = async (file: File, worker: Tesseract.Worker): Promise<string> => {
        const buffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument(buffer).promise
        let fullText = ''

        for (let i = 1; i <= pdf.numPages; i++) {
            setStatusMessage(`Scanning page ${i} of ${pdf.numPages}...`)
            setProgress((i / pdf.numPages) * 100)

            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: 2.0 })
            const canvas = document.createElement('canvas')
            const context = canvas.getContext('2d')

            if (!context) continue

            canvas.height = viewport.height
            canvas.width = viewport.width

            await page.render({ canvasContext: context, viewport } as any).promise

            const imageData = canvas.toDataURL('image/png')
            const { data } = await worker.recognize(imageData)
            fullText += data.text + '\n\n'
        }

        return fullText
    }

    const analyzeText = async (text: string) => {
        setStatusMessage('Analyzing sources...')

        // Simple heuristic: Split by double newlines or punctuation looking for source-like structures
        // This is a naive implementation. In a real app, we'd use an LLM or more complex NLP.
        const lines = text.split(/\n+/).filter(line => line.trim().length > 10)

        const analyzedSources: ScannedSource[] = []

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            const source: ScannedSource = {
                id: Math.random().toString(36).substr(2, 9),
                originalText: line,
                cleanedText: line,
                confidence: 0.5 // Default
            }

            // Attempt to find Sefaria Ref (very basic regex for example)
            // Matches "Book Chapter:Verse" or "Book Daf a/b" patterns roughly
            // Real implementation requires a dictionary of Sefaria book names

            analyzedSources.push(source)
        }

        setSources(analyzedSources)
        setStatus('complete')
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/*': ['.png', '.jpg', '.jpeg']
        },
        maxFiles: 1
    })

    const searchSefaria = async (sourceId: string, query: string) => {
        try {
            // Sefaria Search API
            const response = await fetch(`https://www.sefaria.org/api/search-wrapper`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    type: 'text',
                    size: 1
                })
            })

            const data = await response.json()
            if (data.hits && data.hits.hits.length > 0) {
                const hit = data.hits.hits[0]._source
                const ref = hit.ref

                // Get Text content
                const textRes = await fetch(`https://www.sefaria.org/api/texts/${ref}`)
                const textData = await textRes.json()

                setSources(prev => prev.map(s =>
                    s.id === sourceId ? {
                        ...s,
                        sefariaRef: ref,
                        sefariaData: textData,
                        cleanedText: textData.he // Use found Hebrew text
                    } : s
                ))
            }
        } catch (e) {
            console.error(e)
        }
    }

    // Auto-search effect (simplified)
    // In a real app, we would batch this or user triggers it

    return (
        <div className="space-y-8">
            <div
                {...getRootProps()}
                className={`border-3 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'}`}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-primary/10 rounded-full">
                        <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <p className="text-xl font-medium text-gray-900">
                            {isDragActive ? 'Drop your sources here' : 'Drag & drop PDF or Image'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            Supports scanned PDFs, PNG, JPG. We will extract the text automatically.
                        </p>
                    </div>
                </div>
            </div>

            {status !== 'idle' && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>{statusMessage}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {sources.length > 0 && (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Extracted Sources
                    </h3>

                    <div className="grid gap-6">
                        {sources.map(source => (
                            <div key={source.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
                                <div className="flex gap-4">
                                    <div className="flex-1 space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-gray-500 uppercase">Original Text</label>
                                            <p className="p-3 bg-gray-50 rounded-md text-right font-serif text-lg leading-relaxed" dir="rtl">
                                                {source.originalText}
                                            </p>
                                        </div>

                                        {source.sefariaRef && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-primary uppercase flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    Identified in Sefaria: {source.sefariaRef}
                                                </label>
                                                <div className="p-3 border border-primary/20 bg-primary/5 rounded-md text-right font-serif text-lg leading-relaxed" dir="rtl">
                                                    {source.sefariaData?.he}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-64 space-y-3 pt-6 border-l pl-4">
                                        <button
                                            onClick={() => searchSefaria(source.id, source.originalText)}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-[#20365F] rounded-md hover:bg-[#20365F]/90 transition-colors"
                                        >
                                            <img src="/sefaria-icon.png" className="w-4 h-4" alt="" />
                                            Find in Sefaria
                                        </button>

                                        <a
                                            href={`https://hebrewbooks.org/pdfpager.aspx?req=${encodeURIComponent(source.originalText.substring(0, 20))}&st=on`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                        >
                                            <Book className="w-4 h-4" />
                                            Search HebrewBooks
                                        </a>

                                        <div className="pt-4 border-t">
                                            <p className="text-xs text-center text-gray-500">
                                                Edit text to improve search accuracy
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
