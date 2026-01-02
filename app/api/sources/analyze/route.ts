import { NextRequest, NextResponse } from 'next/server'

// Edge runtime for Cloudflare compatibility
export const runtime = 'edge'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

interface DetectedSource {
    id: string
    box: { x: number; y: number; width: number; height: number }
    hebrewText: string
    reference: string | null
    confidence: number
}

export async function POST(request: NextRequest) {
    if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    try {
        const formData = await request.formData()
        const file = formData.get('image') as File

        if (!file) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 })
        }

        // Convert image to base64
        const bytes = await file.arrayBuffer()
        const base64 = Buffer.from(bytes).toString('base64')
        const mimeType = file.type || 'image/png'

        // Call Gemini Vision API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `You are analyzing a Torah source sheet image. Your task is to:

1. DETECT every distinct source/text block on the page
2. For each source, provide:
   - Bounding box coordinates as percentages (0-100) of image dimensions
   - The Hebrew text content (OCR it accurately)
   - The source reference if identifiable (e.g., "Rashi on Bereishit 1:1", "Gemara Berachot 5a", "Rambam Hilchot Shabbat 1:1")

IMPORTANT DETECTION RULES:
- Each numbered source (①, ②, 1., 2., etc.) is a SEPARATE source
- Headers/titles with their text below count as ONE source
- Ignore page numbers, watermarks, and decorative elements
- Sources can be in Hebrew, Aramaic, or English
- Look for circled numbers, brackets, or indentation to identify source boundaries

Return ONLY valid JSON in this exact format:
{
  "sources": [
    {
      "box": { "x": 5, "y": 10, "width": 45, "height": 20 },
      "hebrewText": "בראשית ברא אלהים...",
      "reference": "Bereishit 1:1",
      "confidence": 0.95
    }
  ]
}

If you cannot detect any sources, return: { "sources": [] }
Do NOT include any text before or after the JSON.`
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
                        topP: 0.8,
                        maxOutputTokens: 8192
                    }
                })
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Gemini API error:', errorText)
            return NextResponse.json({
                error: 'Gemini API error',
                details: errorText,
                sources: []
            }, { status: 200 }) // Return 200 with empty sources to allow fallback
        }

        const data = await response.json()

        // Extract text from response
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // Parse JSON from response
        let sources: DetectedSource[] = []
        try {
            // Find JSON in response (handle markdown code blocks)
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0])
                sources = (parsed.sources || []).map((s: any, i: number) => ({
                    id: `source-${Date.now()}-${i}`,
                    box: {
                        x: Math.max(0, Math.min(100, s.box?.x || 0)),
                        y: Math.max(0, Math.min(100, s.box?.y || 0)),
                        width: Math.max(1, Math.min(100, s.box?.width || 10)),
                        height: Math.max(1, Math.min(100, s.box?.height || 10))
                    },
                    hebrewText: s.hebrewText || '',
                    reference: s.reference || null,
                    confidence: s.confidence || 0.5
                }))
            }
        } catch (parseError) {
            console.error('Failed to parse Gemini response:', text)
        }

        return NextResponse.json({
            sources,
            rawResponse: text.substring(0, 500) // For debugging
        })

    } catch (error) {
        console.error('Analysis error:', error)
        return NextResponse.json({
            error: 'Analysis failed',
            details: String(error),
            sources: []
        }, { status: 200 })
    }
}
