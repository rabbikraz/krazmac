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
            regions = [{ title: 'Source 1', box_2d: [0, 0, 1000, 1000] }]
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

    const prompt = `You are a Layout Analysis AI specialized in Jewish Text Source Sheets.

CRITICAL OBSERVATION:
This page uses a COMPLEX LAYOUT with multiple COLUMNS and ROWS.
It contains between 5 and 20 distinct source citations.
They are often numbered (handwritten or typed 1, 2, 3...).

TASK:
Detect the 2D Bounding Box for EVERY distinct source block.
Do NOT group columns together.
Source 1 and Source 2 might be side-by-side. Isolate them.

Return a JSON object with a "regions" array.
Each region: { "title": "Source X", "box_2d": [ymin, xmin, ymax, xmax] }
(Coordinates 0-1000).

Example:
{
  "regions": [
    { "title": "Source 1", "box_2d": [10, 10, 150, 480] },
    { "title": "Source 2", "box_2d": [10, 520, 150, 990] }
  ]
}

Return ONLY valid JSON.`

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
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

        if (text.includes('```')) {
            const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (match) text = match[1]
        }

        const result = JSON.parse(text.trim())
        return result.regions || []

    } catch (e) {
        console.error('Gemini error:', e)
        return []
    }
}
