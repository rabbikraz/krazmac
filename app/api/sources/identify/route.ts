import { NextRequest, NextResponse } from 'next/server'

// Use same pattern as analyze route which works
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
        return NextResponse.json({ success: false, error: 'GEMINI_API_KEY not configured' })
    }

    try {
        const formData = await request.formData()
        const imageFile = formData.get('image') as File

        if (!imageFile) {
            return NextResponse.json({ success: false, error: 'No image provided' })
        }

        console.log('--- Identifying source with Gemini ---')

        // Convert to base64 (same method as analyze route)
        const arrayBuffer = await imageFile.arrayBuffer()
        const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        const mimeType = imageFile.type || 'image/png'

        // Call Gemini API
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `You are an expert in Torah, Talmud, and Jewish texts. Look at this image of Hebrew/Aramaic text.

TASK: Identify what Torah source this text is from.

1. READ the Hebrew/Aramaic text in the image
2. IDENTIFY the source (Gemara, Mishnah, Rashi, Tosafot, Rambam, Shulchan Aruch, Midrash, etc.)
3. Provide the EXACT reference

Examples of references:
- "Berakhot 2a" (Talmud)
- "Rashi on Genesis 1:1" 
- "Mishneh Torah, Laws of Sabbath 1:1"
- "Shulchan Aruch, Orach Chaim 1:1"

Return ONLY a JSON object in this exact format, no other text:
{"candidates":[{"sourceName":"Human readable name","sefariaRef":"Sefaria-compatible reference","previewText":"First few Hebrew words"}]}

If you can identify multiple possible sources, return up to 3 candidates.
If you cannot identify the source, still return your best guess.`
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
                        maxOutputTokens: 2048
                    }
                })
            }
        )

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error('Gemini API Error:', errorText)
            return NextResponse.json({ success: false, error: `Gemini API Error: ${geminiResponse.status}` })
        }

        const geminiData: GeminiResponse = await geminiResponse.json()
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

        console.log('Gemini Response:', responseText.substring(0, 300))

        // Parse JSON from response (same pattern as analyze route)
        let result = { candidates: [] as any[] }
        try {
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
            result = JSON.parse(jsonStr)
        } catch (parseError) {
            console.error('JSON parse error:', parseError, 'Response:', responseText.substring(0, 500))
        }

        const candidates = result.candidates || []
        console.log(`Found ${candidates.length} candidates`)

        if (candidates.length === 0) {
            // Return the raw response for debugging
            return NextResponse.json({
                success: true,
                candidates: [],
                debug: responseText.substring(0, 200)
            })
        }

        return NextResponse.json({
            success: true,
            candidates
        })

    } catch (error) {
        console.error('Identification Error:', error)
        return NextResponse.json({
            success: false,
            error: String(error)
        })
    }
}
