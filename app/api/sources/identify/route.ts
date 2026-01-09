import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_API_KEY || 'AIzaSyAXKKKN7H5WmZjQXipg7ghBQHkIxhVyWN0'
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
    try {
        const formData = await request.formData()
        const imageFile = formData.get('image') as File

        if (!imageFile) {
            return NextResponse.json({ success: false, error: 'No image provided' })
        }

        // Convert to base64
        const arrayBuffer = await imageFile.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const mimeType = imageFile.type || 'image/png'

        const candidates: Array<{ sourceName: string, sefariaRef: string, previewText: string, source?: string }> = []

        // ============================================
        // STRATEGY 1: Try Gemini first (it knows sources)
        // ============================================

        if (GEMINI_API_KEY) {
            try {
                console.log('Trying Gemini identification...')
                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    {
                                        text: `Look at this Hebrew/Aramaic text image. Identify the Torah source.

Return JSON only:
{"candidates":[{"sourceName":"Full name","sefariaRef":"Sefaria ref","previewText":"First words"}]}

Examples of sefariaRef format:
- "Berakhot 2a" 
- "Rashi on Genesis 1:1"
- "Mishneh Torah, Sabbath 1:1"
- "Shulchan Arukh, Orach Chayim 1:1"

Return your best guess even if unsure.`
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
                                maxOutputTokens: 1024
                            }
                        })
                    }
                )

                if (geminiResponse.ok) {
                    const geminiData: GeminiResponse = await geminiResponse.json()
                    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
                    console.log('Gemini response:', responseText.substring(0, 200))

                    // Parse JSON
                    try {
                        let jsonStr = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
                        const match = jsonStr.match(/\{[\s\S]*\}/)
                        if (match) {
                            const result = JSON.parse(match[0])
                            if (result.candidates?.length > 0) {
                                for (const c of result.candidates) {
                                    candidates.push({
                                        sourceName: c.sourceName || c.sefariaRef,
                                        sefariaRef: c.sefariaRef || '',
                                        previewText: c.previewText || '',
                                        source: 'Gemini AI'
                                    })
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Gemini parse error:', e)
                    }
                } else {
                    console.log('Gemini returned:', geminiResponse.status)
                }
            } catch (e) {
                console.error('Gemini error:', e)
            }
        }

        // If Gemini found results, return them
        if (candidates.length > 0) {
            return NextResponse.json({ success: true, candidates })
        }

        // ============================================
        // STRATEGY 2: Fall back to OCR + Sefaria Search
        // ============================================

        console.log('Falling back to OCR + Sefaria...')

        // OCR with Vision API
        const visionRes = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{
                        image: { content: base64 },
                        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
                    }]
                })
            }
        )

        if (!visionRes.ok) {
            return NextResponse.json({ success: false, error: `Vision API Error: ${visionRes.status}` })
        }

        const visionData = await visionRes.json() as any
        const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text

        if (!fullText) {
            return NextResponse.json({ success: false, error: 'No text detected' })
        }

        // Clean and search
        const cleanText = fullText
            .replace(/[\u0591-\u05C7]/g, '')
            .replace(/[^\u05D0-\u05EA\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

        const words = cleanText.split(' ').filter((w: string) => w.length > 1)
        const searchPhrase = words.slice(0, 12).join(' ')

        console.log('Searching Sefaria for:', searchPhrase)

        // Search Sefaria
        try {
            const sefariaUrl = `https://www.sefaria.org/api/search-wrapper?q=${encodeURIComponent(searchPhrase)}&type=text&size=5`
            const sefariaRes = await fetch(sefariaUrl, { signal: AbortSignal.timeout(10000) })

            if (sefariaRes.ok) {
                const sefariaData = await sefariaRes.json() as any
                const hits = sefariaData.hits?.hits || []

                for (const hit of hits) {
                    const source = hit._source || hit
                    if (source.ref) {
                        candidates.push({
                            sourceName: source.ref,
                            sefariaRef: source.ref,
                            previewText: (source.he || '').substring(0, 100),
                            source: 'Sefaria Search'
                        })
                    }
                }
            }
        } catch (e) {
            console.error('Sefaria error:', e)
        }

        // Return whatever we found
        if (candidates.length === 0) {
            candidates.push({
                sourceName: 'OCR Text (no match)',
                sefariaRef: '',
                previewText: cleanText.substring(0, 150),
                source: 'OCR Only'
            })
        }

        return NextResponse.json({
            success: true,
            candidates,
            ocrText: cleanText.substring(0, 100)
        })

    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ success: false, error: String(error) })
    }
}
