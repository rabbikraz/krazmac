import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file' }, { status: 400 })
        }

        const bytes = await file.arrayBuffer()
        const base64 = Buffer.from(bytes).toString('base64')
        const mimeType = file.type.startsWith('image/') ? file.type : 'image/png'

        // Try Gemini to auto-detect source regions
        let regions = await findSourceRegions(base64, mimeType)

        // If Gemini failed or returned nothing, default to one full-page source
        if (!regions || regions.length === 0) {
            regions = [{ title: 'Source 1', y: 0, height: 100 }]
        }

        return NextResponse.json({
            success: true,
            image: `data:${mimeType};base64,${base64}`,
            regions
        })
    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}

async function findSourceRegions(base64: string, mimeType: string) {
    if (!GEMINI_API_KEY) {
        console.log('No Gemini API key')
        return []
    }

    const prompt = `Analyze this Hebrew source sheet image. Your job is to identify where each individual source/text begins and ends.

LOOK FOR THESE SEPARATORS:
- Numbers (1, 2, 3 or א, ב, ג) at the start of sources
- Bold headers or titles
- Larger gaps/whitespace between text blocks
- Horizontal lines
- Different fonts or indentation

For EACH separate source you identify, give me:
- title: The source name if visible (like "רש"י", "גמרא ברכות", "רמב"ם"), or "Source 1", "Source 2" etc.
- y: Where this source STARTS as a percentage from the top (0 = very top, 100 = very bottom)
- height: How tall this source is as a percentage of the page

Example response for a page with 3 sources:
[
  {"title": "רש\"י בראשית", "y": 0, "height": 30},
  {"title": "תוספות", "y": 32, "height": 35},
  {"title": "רמב\"ן", "y": 68, "height": 30}
]

IMPORTANT: 
- Find ALL sources, there could be 2, 5, 10, or more
- Make sure y + height values don't exceed 100
- Leave small gaps between sources (the y of one should be slightly after y+height of previous)

Return ONLY the JSON array, nothing else.`

    try {
        const res = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-goog-api-key': GEMINI_API_KEY
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: base64 } }
                        ]
                    }]
                })
            }
        )

        if (!res.ok) {
            console.error('Gemini error:', res.status, await res.text())
            return []
        }

        const data = await res.json() as any
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

        console.log('Gemini:', text.substring(0, 200))

        if (text.includes('```')) {
            const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (match) text = match[1]
        }

        return JSON.parse(text.trim())
    } catch (e) {
        console.error('Gemini error:', e)
        return []
    }
}
