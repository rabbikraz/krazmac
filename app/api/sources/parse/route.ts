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

        // Try Gemini to analyze layout
        let regions = await analyzeAndSlice(base64, mimeType)

        // If failed, default to one full-page source
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

async function analyzeAndSlice(base64: string, mimeType: string) {
    if (!GEMINI_API_KEY) {
        console.log('No Gemini API key')
        return []
    }

    // Step 1: Ask AI to COUNT sources and describe layout
    const prompt = `Analyze this Jewish source sheet image.

COUNT the number of distinct text sources/citations on this page.
Look for:
- Numbered sections (1, 2, 3... or א, ב, ג...)
- Bold headers separating sources
- Clear visual gaps between text blocks

Also determine the LAYOUT:
- Is it single column or multiple columns?
- How many rows of sources are there?

Return JSON:
{
  "source_count": <number between 1 and 20>,
  "columns": <1 or 2>,
  "rows": <number of rows>,
  "layout_description": "<brief description>"
}

Be precise. Count EVERY separate source block.`

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

        console.log('Gemini raw:', text)

        if (text.includes('```')) {
            const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (match) text = match[1]
        }

        const analysis = JSON.parse(text.trim())
        const count = Math.min(20, Math.max(1, analysis.source_count || 1))
        const cols = analysis.columns || 1
        const rows = analysis.rows || Math.ceil(count / cols)

        console.log(`Detected: ${count} sources, ${cols} columns, ${rows} rows`)

        // Step 2: Generate grid of regions based on count and layout
        const regions: any[] = []
        let sourceNum = 1

        const colWidth = Math.floor(1000 / cols)
        const rowHeight = Math.floor(1000 / rows)

        for (let r = 0; r < rows && sourceNum <= count; r++) {
            for (let c = 0; c < cols && sourceNum <= count; c++) {
                const ymin = r * rowHeight
                const ymax = (r + 1) * rowHeight
                const xmin = c * colWidth
                const xmax = (c + 1) * colWidth

                regions.push({
                    title: `Source ${sourceNum}`,
                    box_2d: [ymin, xmin, ymax, xmax]
                })
                sourceNum++
            }
        }

        return regions

    } catch (e) {
        console.error('Gemini error:', e)
        return []
    }
}
