import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY || 'AIzaSyAXKKKN7H5WmZjQXipg7ghBQHkIxhVyWN0'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size)

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        console.log('Using Google Vision API (Client-side pre-processing mode)...')
        const text = await ocrWithGoogleVision(buffer, file.type)

        console.log('Extracted text length:', text.length)

        const sources = parseSourcesFromText(text)

        return NextResponse.json({
            success: true,
            rawText: text,
            sources,
            method: 'google_vision'
        })
    } catch (error) {
        console.error('Processing error:', error)
        return NextResponse.json({
            error: 'Failed to process file: ' + (error as Error).message
        }, { status: 500 })
    }
}

async function ocrWithGoogleVision(buffer: Buffer, mimeType: string): Promise<string> {
    const base64Content = buffer.toString('base64')

    const requestBody = {
        requests: [
            {
                image: {
                    content: base64Content
                },
                features: [
                    {
                        type: 'DOCUMENT_TEXT_DETECTION'
                    }
                ],
                imageContext: {
                    languageHints: ['he', 'en', 'yi'] // Hebrew, English, Yiddish
                }
            }
        ]
    }

    console.log('Calling Google Vision API...')

    const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        }
    )

    const data = await response.json() as any

    console.log('Google Vision response status:', response.status)

    if (!response.ok) {
        console.error('Google Vision API error:', JSON.stringify(data).substring(0, 500))
        throw new Error(`Google Vision error: ${data.error?.message || response.statusText}`)
    }

    if (data.responses?.[0]?.error) {
        throw new Error(`Vision API error: ${data.responses[0].error.message}`)
    }

    const fullText = data.responses?.[0]?.fullTextAnnotation?.text || ''

    if (!fullText) {
        console.log('No text detected in file')
    }

    return fullText
}

function parseSourcesFromText(text: string): Array<{ id: string; text: string; type: string; title?: string }> {
    if (!text.trim()) return []

    const sources: Array<{ id: string; text: string; type: string; title?: string }> = []

    // Normalize newlines
    const cleanText = text.replace(/\r\n/g, '\n')

    // Regex to find source starters:
    // 1. "Source 1", "Mekor 1", "מקור 1", "מקור א"
    // 2. Numbered list: "1.", "1)", "(1)", "א.", "א)", "(א)"
    // 3. Common headers: "Rashi", "Tosafot", "Gemara", etc (if at start of line)

    const sourceSplitRegex = /(?=\n(?:Source|Mekor|מקור|SOURCE)\s+[\dא-ת]+)|(?=\n(?:\d+|[א-ת])[\.\)])|(?=\n\((?:\d+|[א-ת])\))/g

    // If we can't find clear source indicators, fall back to double newline
    let blocks: string[] = []

    if (sourceSplitRegex.test(cleanText)) {
        console.log('Detected structured sources, splitting by pattern...')
        blocks = cleanText.split(sourceSplitRegex).filter(b => b.trim().length > 10)
    } else {
        console.log('No clear structure detected, simple split...')
        blocks = cleanText.split(/\n{2,}/).filter(b => b.trim().length > 15)
    }

    blocks.forEach((block) => {
        const trimmedBlock = block.trim()
        const hebrewChars = (trimmedBlock.match(/[\u0590-\u05FF]/g) || []).length
        const totalAlphaChars = (trimmedBlock.match(/[a-zA-Z\u0590-\u05FF]/g) || []).length
        const isHebrew = totalAlphaChars > 0 && (hebrewChars / totalAlphaChars) > 0.5

        const lines = trimmedBlock.split('\n')
        let title = ''
        let content = trimmedBlock

        // extract title from first line
        if (lines.length > 0) {
            const firstLine = lines[0].trim()
            // Check if first line is short and looks like a header/number
            if (firstLine.length < 50 && (
                /^(Source|Mekor|מקור|SOURCE)\s+[\dא-ת]+/.test(firstLine) ||
                /^(\d+|[א-ת])[\.\)]/.test(firstLine) ||
                /^\((?:\d+|[א-ת])\)/.test(firstLine) ||
                /רמב"ם|גמרא|משנה|שו"ע|רש"י|תוספות|מדרש|פרק|דף/.test(firstLine)
            )) {
                title = firstLine
                content = lines.slice(1).join('\n').trim()
            }
        }

        sources.push({
            id: crypto.randomUUID(),
            text: content || trimmedBlock,
            type: isHebrew ? 'hebrew' : 'english',
            title: title || undefined
        })
    })

    return sources
}
