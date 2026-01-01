import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBUxKm7aHk1erGj3CPL-Xab8UXSZAWe5IU'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size)

        const bytes = await file.arrayBuffer()
        const base64Data = Buffer.from(bytes).toString('base64')

        let mimeType = file.type
        if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
            mimeType = 'image/png'
        }

        // Use Gemini to identify source regions in the image
        console.log('Asking Gemini to identify source regions...')
        const regions = await identifySourceRegions(base64Data, mimeType)

        if (regions.length === 0) {
            // If no regions found, treat the whole image as one source
            return NextResponse.json({
                success: true,
                rawText: '',
                sources: [{
                    id: crypto.randomUUID(),
                    title: 'Source 1',
                    text: '',
                    type: 'image',
                    imageData: `data:${mimeType};base64,${base64Data}`,
                    cropBox: null // Full image
                }],
                method: 'image_regions'
            })
        }

        // Return the regions - client will handle cropping
        const sources = regions.map((region, i) => ({
            id: crypto.randomUUID(),
            title: region.title || `Source ${i + 1}`,
            text: region.description || '',
            type: 'image',
            imageData: `data:${mimeType};base64,${base64Data}`,
            cropBox: region.box, // { x, y, width, height } as percentages
            rotation: region.rotation || 0
        }))

        return NextResponse.json({
            success: true,
            rawText: '',
            sources,
            method: 'image_regions',
            fullImage: `data:${mimeType};base64,${base64Data}`
        })
    } catch (error) {
        console.error('Processing error:', error)
        return NextResponse.json({
            error: 'Failed: ' + (error as Error).message
        }, { status: 500 })
    }
}

interface SourceRegion {
    title: string
    description: string
    box: { x: number; y: number; width: number; height: number } // percentages 0-100
    rotation: number // 0, 90, 180, 270
}

async function identifySourceRegions(base64Data: string, mimeType: string): Promise<SourceRegion[]> {
    try {
        const prompt = `Look at this Hebrew source sheet. Sources are typically separated by:
- Whitespace or gaps
- Headers or titles
- Numbers (1, 2, 3 or א, ב, ג)
- Different font styles
- Horizontal lines

Identify the RECTANGULAR REGION that contains each source. Even if there's no visible box, identify where each source starts and ends.

For EACH source, provide:
1. title: What the source appears to be (רש"י, גמרא, רמב"ם, etc.) or "Source 1" if unclear
2. description: Brief note about the content
3. box: Rectangle containing this source as percentages (x, y from top-left, width, height)
4. rotation: If text needs rotation to read (0, 90, 180, 270)

Return ONLY a JSON array, no other text:
[
  {"title": "רש\"י", "description": "Commentary", "box": {"x": 0, "y": 0, "width": 100, "height": 25}, "rotation": 0},
  {"title": "גמרא", "description": "Talmud passage", "box": {"x": 0, "y": 26, "width": 100, "height": 30}, "rotation": 0}
]

Be generous with region sizes - include headers and some margin. Sources usually stack vertically on the page.`

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: base64Data } }
                        ]
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 4000 }
                })
            }
        )

        if (!response.ok) {
            console.error('Gemini API error:', response.status)
            return []
        }

        const data = await response.json() as any
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        console.log('Gemini regions response:', content.substring(0, 200))

        // Extract JSON
        let jsonStr = content.trim()
        if (jsonStr.includes('```')) {
            const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (match) jsonStr = match[1].trim()
        }

        const parsed = JSON.parse(jsonStr)
        return Array.isArray(parsed) ? parsed : []
    } catch (e) {
        console.error('Region identification error:', e)
        return []
    }
}
