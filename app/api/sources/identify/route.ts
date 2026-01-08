import { NextRequest, NextResponse } from 'next/server'

// Use Google Vision REST API
const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_API_KEY || 'AIzaSyAXKKKN7H5WmZjQXipg7ghBQHkIxhVyWN0'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const imageFile = formData.get('image') as File

        if (!imageFile) {
            return NextResponse.json({ success: false, error: 'No image provided' })
        }

        console.log('--- OCR with Google Vision REST API ---')

        // Convert to base64
        const arrayBuffer = await imageFile.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')

        // Call Google Vision REST API
        const visionRes = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{
                        image: { content: base64 },
                        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
                    }]
                })
            }
        )

        if (!visionRes.ok) {
            const errorText = await visionRes.text()
            console.error('Vision API Error:', errorText)
            return NextResponse.json({
                success: false,
                error: `Vision API Error: ${visionRes.status}`
            })
        }

        const visionData = await visionRes.json() as any
        const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text

        if (!fullText) {
            return NextResponse.json({
                success: false,
                error: 'No text detected in image'
            })
        }

        console.log(`OCR found ${fullText.length} chars`)

        // Clean up OCR text - remove nikkud and extra whitespace
        const cleanText = fullText
            .replace(/[\u0591-\u05C7]/g, '') // Remove nikkud
            .replace(/\s+/g, ' ')
            .trim()

        // Return OCR text directly - let user identify manually for now
        // We can add Sefaria search later if needed
        return NextResponse.json({
            success: true,
            candidates: [{
                sourceName: 'OCR Result',
                sefariaRef: '',
                previewText: cleanText.substring(0, 300)
            }],
            ocrText: cleanText
        })

    } catch (error) {
        console.error('OCR Error:', error)
        return NextResponse.json({
            success: false,
            error: String(error)
        })
    }
}
