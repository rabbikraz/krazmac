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

CRITICAL TASK:
Scan this Source Sheet image from TOP to BOTTOM.
Identify the Vertical Y-Position (0-1000) where EACH new distinct source begins.
An entire page acts as a stack of sources. You must find the cut points.

Look for:
- A bold Header (e.g. "Rashi", "Gemara")
- A Number/Letter (1, 2, א, ב) at the start of a line
- A horizontal divider line
- Significant vertical gap

Output a JSON object with a single array "split_points".
Include 0 as the first point.
Example:
{
  "split_points": [0, 150, 320, 500, 750] 
}
This implies source 1 is 0-150, source 2 is 150-320, etc.

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
        const splits = result.split_points || []

        // Convert splits to regions
        return splits.map((y: number, i: number) => {
            const nextY = splits[i + 1] || 1000
            if (y >= nextY) return null // bad sort
            return {
                title: `Source ${i + 1}`,
                box_2d: [y, 10, nextY, 990] // Full width (10-990)
            }
        }).filter(Boolean)

    } catch (e) {
        console.error('Gemini error:', e)
        return []
    }
}
