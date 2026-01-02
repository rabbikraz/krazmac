import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string
            }>
        }
    }>
}

export async function POST(request: NextRequest) {
    if (!GEMINI_API_KEY) {
        return NextResponse.json({
            success: false,
            error: 'GEMINI_API_KEY not configured in environment variables',
            sources: []
        })
    }

    try {
        const formData = await request.formData()
        const imageFile = formData.get('image') as File

        if (!imageFile) {
            return NextResponse.json({
                success: false,
                error: 'No image file provided',
                sources: []
            })
        }

        // Convert to base64
        const arrayBuffer = await imageFile.arrayBuffer()
        const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        const mimeType = imageFile.type || 'image/png'

        // Call Gemini API
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `Analyze this Torah/Jewish source sheet image. Find all distinct text sources on the page.

For EACH source you find, return:
1. box_2d: Bounding box as [ymin, xmin, ymax, xmax] where values are 0-1000 (normalized coordinates)
2. text: The Hebrew/Aramaic text content (OCR it)
3. reference: The source reference if you can identify it (e.g., "Bereishit 1:1", "Rashi on Shemot 3:14", "Gemara Berachot 5a")

Detection rules:
- Each numbered section (1, 2, 3 or א, ב, ג or circled numbers) is a SEPARATE source
- Include headers/titles with their associated text as ONE source
- Skip page numbers, decorative elements, and watermarks
- Sources may be in Hebrew, Aramaic, or English

Return ONLY a JSON object in this exact format, no other text:
{"sources":[{"box_2d":[ymin,xmin,ymax,xmax],"text":"...","reference":"..."}]}`
                            },
                            {
                                inlineData: {
                                    mimeType,
                                    data: base64
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 8192
                    }
                })
            }
        )

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error('Gemini error:', errorText)
            return NextResponse.json({
                success: false,
                error: `Gemini API error: ${geminiResponse.status}`,
                sources: []
            })
        }

        const geminiData: GeminiResponse = await geminiResponse.json()
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // Parse JSON from response
        let sources: Array<{ box_2d?: number[]; text?: string; reference?: string }> = []
        try {
            // Extract JSON from response (handle markdown code blocks)
            let jsonStr = responseText
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
            if (jsonMatch) {
                jsonStr = jsonMatch[1]
            } else {
                const plainMatch = responseText.match(/\{[\s\S]*\}/)
                if (plainMatch) {
                    jsonStr = plainMatch[0]
                }
            }

            const parsed = JSON.parse(jsonStr) as { sources?: typeof sources }
            sources = parsed.sources || []
        } catch (parseError) {
            console.error('JSON parse error:', parseError, 'Response:', responseText.substring(0, 500))
        }

        // Normalize and validate sources
        const normalizedSources = sources.map((s, idx) => {
            const box = s.box_2d || [0, 0, 1000, 1000]
            return {
                id: `gemini-${Date.now()}-${idx}`,
                box: {
                    x: Math.max(0, Math.min(100, box[1] / 10)),
                    y: Math.max(0, Math.min(100, box[0] / 10)),
                    width: Math.max(5, Math.min(100, (box[3] - box[1]) / 10)),
                    height: Math.max(5, Math.min(100, (box[2] - box[0]) / 10))
                },
                text: s.text || '',
                reference: s.reference || null
            }
        }).filter(s => s.box.width > 0 && s.box.height > 0)

        return NextResponse.json({
            success: true,
            sources: normalizedSources,
            count: normalizedSources.length
        })

    } catch (error) {
        console.error('Analysis error:', error)
        return NextResponse.json({
            success: false,
            error: String(error),
            sources: []
        })
    }
}
