import { NextRequest, NextResponse } from 'next/server'
import { Storage } from '@google-cloud/storage'
import { ImageAnnotatorClient } from '@google-cloud/vision'

// Credentials
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID
const EMAIL = process.env.GOOGLE_CLIENT_EMAIL
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
const BUCKET_NAME = process.env.GOOGLE_BUCKET_NAME

// Initialize clients
const storage = new Storage({
    projectId: PROJECT_ID,
    credentials: {
        client_email: EMAIL,
        private_key: PRIVATE_KEY,
    },
})

const vision = new ImageAnnotatorClient({
    projectId: PROJECT_ID,
    credentials: {
        client_email: EMAIL,
        private_key: PRIVATE_KEY,
    },
})

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        if (!PROJECT_ID || !EMAIL || !PRIVATE_KEY || !BUCKET_NAME) {
            console.error('Missing Google Cloud credentials')
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        console.log('Processing file:', file.name, 'Size:', file.size, 'Type:', file.type)

        const buffer = Buffer.from(await file.arrayBuffer())

        // 1. Upload to GCS
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        const bucket = storage.bucket(BUCKET_NAME)
        const fileUpload = bucket.file(fileName)

        console.log('Uploading to GCS:', fileName)
        await fileUpload.save(buffer, {
            contentType: file.type,
            resumable: false
        })

        const gcsSourceUri = `gs://${BUCKET_NAME}/${fileName}`
        const outputPrefix = `results-${fileName.split('.')[0]}-`
        const gcsDestinationUri = `gs://${BUCKET_NAME}/${outputPrefix}`

        // 2. Trigger Vision API
        console.log('Triggering Vision API Batch Processing...')

        // For PDFs: Async Batch Annotation
        const [operation] = await vision.asyncBatchAnnotateFiles({
            requests: [
                {
                    inputConfig: {
                        gcsSource: { uri: gcsSourceUri },
                        mimeType: file.type === 'application/pdf' ? 'application/pdf' : 'image/png', // Vision supports PDF/TIFF here. If image, use image/png or image/jpeg
                    },
                    features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
                    outputConfig: {
                        gcsDestination: { uri: gcsDestinationUri },
                        batchSize: 20 // Responses per file
                    },
                    imageContext: {
                        languageHints: ['he', 'en', 'yi']
                    }
                },
            ],
        })

        console.log('Waiting for operation to complete...')
        await operation.promise()
        console.log('Batch processing complete.')

        // 3. Download Results
        console.log('Downloading results...')
        const [files] = await bucket.getFiles({ prefix: outputPrefix })

        let allText = ''

        // Sort files to ensure page order (output-1.json, output-2.json)
        files.sort((a, b) => a.name.localeCompare(b.name))

        for (const file of files) {
            // output files are JSON
            const [content] = await file.download()
            const jsonResponse = JSON.parse(content.toString())

            // Combine text from pages
            const responses = jsonResponse.responses || []
            for (const response of responses) {
                if (response.fullTextAnnotation?.text) {
                    allText += response.fullTextAnnotation.text + '\n\n'
                }
            }
        }

        // Cleanup (optional - maybe keep for debugging or cleanup later)
        // await fileUpload.delete()
        // await bucket.deleteFiles({ prefix: outputPrefix })

        console.log('Extracted text length:', allText.length)

        const sources = parseSourcesFromText(allText)

        return NextResponse.json({
            success: true,
            rawText: allText,
            sources,
            method: 'google_vision_batch'
        })

    } catch (error) {
        console.error('Processing error:', error)
        return NextResponse.json({
            error: 'Failed to process file: ' + (error as Error).message
        }, { status: 500 })
    }
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
