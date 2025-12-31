import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY || 'AIzaSyAXKKKN7H5WmZjQXipg7ghBQHkIxhVyWN0'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File
        const useOCR = formData.get('useOCR') === 'true'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        let text = ''

        if (useOCR || file.type.startsWith('image/')) {
            // Use Google Cloud Vision for OCR
            text = await ocrWithGoogleVision(buffer)
        } else {
            // Try to extract embedded text from PDF first
            text = await extractTextFromPdf(buffer)

            // If no text found, fallback to OCR
            if (!text.trim()) {
                text = await ocrWithGoogleVision(buffer)
            }
        }

        // Parse the text into individual sources
        const sources = parseSourcesFromText(text)

        return NextResponse.json({
            success: true,
            rawText: text,
            sources
        })
    } catch (error) {
        console.error('PDF processing error:', error)
        return NextResponse.json({ error: 'Failed to process file: ' + (error as Error).message }, { status: 500 })
    }
}

async function ocrWithGoogleVision(buffer: Buffer): Promise<string> {
    const base64Image = buffer.toString('base64')

    const requestBody = {
        requests: [
            {
                image: {
                    content: base64Image
                },
                features: [
                    {
                        type: 'DOCUMENT_TEXT_DETECTION',
                        maxResults: 1
                    }
                ],
                imageContext: {
                    languageHints: ['he', 'en', 'yi'] // Hebrew, English, Yiddish
                }
            }
        ]
    }

    const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        }
    )

    if (!response.ok) {
        const errorData = await response.json() as any
        throw new Error(`Google Vision API error: ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json() as any

    // Extract full text from the response
    const fullText = data.responses?.[0]?.fullTextAnnotation?.text || ''

    return fullText
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    // Simple text extraction for PDFs with embedded text
    const pdfString = buffer.toString('latin1')

    const textBlocks: string[] = []
    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g
    let match

    while ((match = streamRegex.exec(pdfString)) !== null) {
        const stream = match[1]
        const textRegex = /\((.*?)\)Tj|\[(.*?)\]TJ/g
        let textMatch
        while ((textMatch = textRegex.exec(stream)) !== null) {
            const text = textMatch[1] || textMatch[2]
            if (text) {
                const decoded = text
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r')
                    .replace(/\\t/g, '\t')
                    .replace(/\\\(/g, '(')
                    .replace(/\\\)/g, ')')
                    .replace(/\\\\/g, '\\')
                textBlocks.push(decoded)
            }
        }
    }

    return textBlocks.join(' ').trim()
}

function parseSourcesFromText(text: string): Array<{ id: string; text: string; type: string; title?: string }> {
    if (!text.trim()) return []

    const sources: Array<{ id: string; text: string; type: string; title?: string }> = []

    // Split by multiple newlines, numbered patterns, or Hebrew letter patterns
    // This handles typical source sheet formats
    const blocks = text
        .split(/\n{2,}/)
        .map(b => b.trim())
        .filter(b => b.length > 15)

    blocks.forEach((block, index) => {
        // Detect if primarily Hebrew
        const hebrewChars = (block.match(/[\u0590-\u05FF]/g) || []).length
        const totalAlphaChars = (block.match(/[a-zA-Z\u0590-\u05FF]/g) || []).length
        const isHebrew = totalAlphaChars > 0 && (hebrewChars / totalAlphaChars) > 0.5

        // Try to detect a title (first line if it looks like a reference)
        const lines = block.split('\n')
        let title = ''
        let content = block

        // Check if first line looks like a source reference
        if (lines.length > 1) {
            const firstLine = lines[0].trim()
            // Common patterns: starts with Hebrew book name, has chapter/verse markers, is short
            const looksLikeTitle = (
                firstLine.length < 100 &&
                (
                    /^[א-ת]/.test(firstLine) || // Starts with Hebrew
                    /רמב"ם|גמרא|משנה|שו"ע|רש"י|תוספות|מדרש|פרק|דף/.test(firstLine) || // Common source markers
                    /^\d+[\.\)]/.test(firstLine) // Numbered
                )
            )

            if (looksLikeTitle) {
                title = firstLine
                content = lines.slice(1).join('\n').trim()
            }
        }

        sources.push({
            id: crypto.randomUUID(),
            text: content || block,
            type: isHebrew ? 'hebrew' : 'english',
            title: title || undefined
        })
    })

    return sources
}
