import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBUxKm7aHk1erGj3CPL-Xab8UXSZAWe5IU'

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

        // Ask Gemini to find source regions
        const regions = await findSourceRegions(base64, mimeType)

        return NextResponse.json({
            success: true,
            regions,
            image: `data:${mimeType};base64,${base64}`
        })
    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}

async function findSourceRegions(base64: string, mimeType: string) {
    const prompt = `This is a Hebrew source sheet with multiple sources.

Find each source and give me its bounding box as percentages (0-100).
Sources are separated by whitespace, headers, numbers, or lines.

Return ONLY a JSON array like this:
[
  {"title": "Source name or number", "y": 0, "height": 25},
  {"title": "Next source", "y": 26, "height": 30}
]

y = where this source STARTS (% from top)
height = how TALL this source is (%)

Sources go full width, so no x/width needed.
Return [] if you can't identify sources.`

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType, data: base64 } }
                        ]
                    }],
                    generationConfig: { temperature: 0.1 }
                })
            }
        )

        const data = await res.json() as any
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

        // Extract JSON from response
        if (text.includes('```')) {
            const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (match) text = match[1]
        }

        return JSON.parse(text.trim())
    } catch {
        return []
    }
}
