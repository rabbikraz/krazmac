import { NextRequest, NextResponse } from 'next/server'

// Note: Don't use edge runtime here - OpenNext handles this automatically

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: NextRequest) {
    if (!GEMINI_API_KEY) {
        return NextResponse.json({
            success: false,
            error: 'GEMINI_API_KEY not configured',
        })
    }

    try {
        const formData = await request.formData()
        const imageFile = formData.get('image') as File

        if (!imageFile) {
            return NextResponse.json({
                success: false,
                error: 'No image file provided',
            })
        }

        // Convert to base64
        const arrayBuffer = await imageFile.arrayBuffer()
        const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        const mimeType = imageFile.type || 'image/png'

        // Call Gemini API (using Flash for speed/cost)
        // We ask for multiple candidates/interpretations if unclear, but usually one good one is enough.
        // We explicitly ask for Sefaria-compatible refs.
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `You are a helper for a Jewish study app. 
Analyze this image of a text. It is likely a clipping from a Sefer (Torah book).
1. OCR the Hebrew text accurately.
2. Identify the source (Book, Chapter, Verse/Page).
3. Provide the likely "Sefaria Reference" format (e.g., "Berakhot 2a", "Rashi on Genesis 1:1", "Mishneh Torah, Sabbath 1:1").
4. If there are multiple possibilities or it's ambiguous, list the top 3 most likely options.

Return a JSON object in this exact format:
{
  "candidates": [
    {
      "sourceName": "Name of the source (e.g. 'Rashi on Bereishit 1:1')",
      "sefariaRef": "Sefaria style ref (e.g. 'Rashi on Genesis 1:1.1')",
      "previewText": "The beginning of the Hebrew text found..."
    }
  ]
}
Return ONLY valid JSON.
`
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
                        maxOutputTokens: 2048,
                        responseMimeType: "application/json"
                    }
                })
            }
        )

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error('Gemini identify error:', errorText)
            return NextResponse.json({ success: false, error: 'AI Analysis failed' })
        }

        interface GeminiResponse {
            candidates?: Array<{
                content?: {
                    parts?: Array<{
                        text?: string
                    }>
                }
            }>
        }

        const geminiData = await geminiResponse.json() as GeminiResponse
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // Parse JSON
        let result = { candidates: [] }
        try {
            // It should be strictly JSON due to responseMimeType, but safety check
            result = JSON.parse(responseText)
        } catch (e) {
            console.error('Failed to parse Gemini JSON', responseText)
            // Fallback: try to extract json block
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                try { result = JSON.parse(jsonMatch[0] || jsonMatch[1]) } catch { }
            }
        }

        return NextResponse.json({
            success: true,
            candidates: result.candidates || []
        })

    } catch (error) {
        console.error('Identify error:', error)
        return NextResponse.json({
            success: false,
            error: String(error)
        })
    }
}
