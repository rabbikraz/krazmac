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

    const prompt = `You are a Layout Analysis AI specialized in Hebrew Text.

CRITICAL INSTRUCTION:
Do NOT return the whole page as one source. 
This page contains MULTIPLE distinct source citations (Rashi, Gemara, etc.).
You MUST split the text into separate parts.

Look for:
- Numbering (1, 2, 3...)
- Bold Headers (Title lines)
- New Paragraphs with hanging indents
- Vertical whitespace gaps

Task:
Return a JSON array of bounding boxes ([ymin, xmin, ymax, xmax] 0-1000).
Find EVERY distinctive text block.
If you are unsure, split by paragraphs.

Example Output:
[
  { "title": "Source 1", "box_2d": [50, 50, 200, 950] },
  { "title": "Source 2", "box_2d": [210, 50, 450, 950] },
  { "title": "Source 3", "box_2d": [460, 50, 800, 950] }
]

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
