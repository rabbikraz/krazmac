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
    const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(b => b.length > 15)

    blocks.forEach((block) => {
        const hebrewChars = (block.match(/[\u0590-\u05FF]/g) || []).length
        const totalAlphaChars = (block.match(/[a-zA-Z\u0590-\u05FF]/g) || []).length
        const isHebrew = totalAlphaChars > 0 && (hebrewChars / totalAlphaChars) > 0.5

        const lines = block.split('\n')
        let title = ''
        let content = block

        if (lines.length > 1) {
            const firstLine = lines[0].trim()
            const looksLikeTitle = (
                firstLine.length < 100 &&
                (/^[א-ת]/.test(firstLine) || /רמב"ם|גמרא|משנה|שו"ע|רש"י|תוספות|מדרש|פרק|דף/.test(firstLine) || /^\d+[\.\)]/.test(firstLine))
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
