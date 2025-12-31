import { NextRequest, NextResponse } from 'next/server'

const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || 'K83119185988957'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File
        const useOCR = formData.get('useOCR') === 'true'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size, 'UseOCR:', useOCR)

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        let text = ''
        let method = ''

        const isImage = file.type.startsWith('image/')
        const isPdf = file.type === 'application/pdf'

        if (useOCR || isImage) {
            // Use OCR.space for both PDFs and images
            console.log('Using OCR.space...')
            text = await ocrWithOcrSpace(buffer, file.name, file.type)
            method = 'ocr_space'
        } else if (isPdf) {
            // Try embedded text extraction first
            console.log('Trying embedded text extraction...')
            text = await extractTextFromPdf(buffer)
            method = 'pdf_text'

            if (!text.trim()) {
                // No embedded text, use OCR
                console.log('No embedded text, falling back to OCR.space...')
                text = await ocrWithOcrSpace(buffer, file.name, file.type)
                method = 'ocr_space'
            }
        } else {
            return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
        }

        console.log('Extracted text length:', text.length, 'Method:', method)

        const sources = parseSourcesFromText(text)

        return NextResponse.json({
            success: true,
            rawText: text,
            sources,
            method
        })
    } catch (error) {
        console.error('Processing error:', error)
        return NextResponse.json({
            error: 'Failed to process file: ' + (error as Error).message
        }, { status: 500 })
    }
}

async function ocrWithOcrSpace(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const base64Data = buffer.toString('base64')
    const base64File = `data:${mimeType};base64,${base64Data}`

    // Use Engine 1
    const formData = new FormData()
    formData.append('base64Image', base64File)
    formData.append('language', 'heb') // Hebrew
    formData.append('isOverlayRequired', 'false')
    formData.append('filetype', mimeType === 'application/pdf' ? 'PDF' : 'AUTO')
    formData.append('detectOrientation', 'true')
    formData.append('scale', 'true')
    formData.append('OCREngine', '1')

    console.log('Calling OCR.space API with Hebrew...')

    const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
            'apikey': OCR_SPACE_API_KEY
        },
        body: formData
    })

    const data = await response.json() as any

    console.log('OCR.space response:', JSON.stringify(data).substring(0, 500))

    if (data.IsErroredOnProcessing) {
        throw new Error(`OCR.space error: ${data.ErrorMessage?.[0] || 'Unknown error'}`)
    }

    if (data.OCRExitCode !== 1) {
        throw new Error(`OCR failed with exit code: ${data.OCRExitCode}. ${data.ErrorMessage?.[0] || ''}`)
    }

    // Combine text from all parsed results (for multi-page PDFs)
    const allText = data.ParsedResults
        ?.map((result: any) => result.ParsedText || '')
        .join('\n\n') || ''

    return allText.trim()
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
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

    const blocks = text
        .split(/\n{2,}/)
        .map(b => b.trim())
        .filter(b => b.length > 15)

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
                (
                    /^[א-ת]/.test(firstLine) ||
                    /רמב"ם|גמרא|משנה|שו"ע|רש"י|תוספות|מדרש|פרק|דף/.test(firstLine) ||
                    /^\d+[\.\)]/.test(firstLine)
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
