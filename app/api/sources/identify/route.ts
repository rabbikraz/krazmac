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
    const debugLog: string[] = []

    try {
        const formData = await request.formData()
        const imageFile = formData.get('image') as File

        if (!imageFile) {
            return NextResponse.json({ success: false, error: 'No image provided' })
        }

        const arrayBuffer = await imageFile.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const mimeType = imageFile.type || 'image/png'

        const candidates: Array<{ sourceName: string, sefariaRef: string, previewText: string, source?: string }> = []

        // ============================================
        // STRATEGY 1: Try Gemini first
        // ============================================

        if (GEMINI_API_KEY) {
            debugLog.push('Trying Gemini...')
            try {
                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: `Identify this Hebrew/Aramaic Torah text. Return JSON: {"candidates":[{"sourceName":"Name","sefariaRef":"Ref like Berakhot 2a","previewText":"First words"}]}` },
                                    { inlineData: { mimeType, data: base64 } }
                                ]
                            }],
                            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
                        })
                    }
                )

                debugLog.push(`Gemini status: ${geminiResponse.status}`)

                if (geminiResponse.ok) {
                    const geminiData: GeminiResponse = await geminiResponse.json()
                    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
                    debugLog.push(`Gemini text: ${responseText.substring(0, 100)}`)

                    try {
                        const match = responseText.match(/\{[\s\S]*\}/)
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
                                debugLog.push(`Gemini found ${candidates.length} candidates`)
                            }
                        }
                    } catch (e) {
                        debugLog.push(`Gemini parse error: ${e}`)
                    }
                }
            } catch (e) {
                debugLog.push(`Gemini error: ${e}`)
            }
        } else {
            debugLog.push('No GEMINI_API_KEY configured')
        }

        if (candidates.length > 0) {
            return NextResponse.json({ success: true, candidates, debug: debugLog })
        }

        // ============================================
        // STRATEGY 2: OCR + Sefaria Search
        // ============================================

        debugLog.push('Falling back to OCR + Sefaria...')

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

        debugLog.push(`Vision status: ${visionRes.status}`)

        if (!visionRes.ok) {
            const errText = await visionRes.text()
            debugLog.push(`Vision error: ${errText.substring(0, 100)}`)
            return NextResponse.json({ success: false, error: `Vision API Error: ${visionRes.status}`, debug: debugLog })
        }

        const visionData = await visionRes.json() as any
        const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text

        if (!fullText) {
            debugLog.push('No text detected in image')
            return NextResponse.json({ success: false, error: 'No text detected', debug: debugLog })
        }

        debugLog.push(`OCR found ${fullText.length} chars`)

        // Clean text
        const cleanText = fullText
            .replace(/[\u0591-\u05C7]/g, '')
            .replace(/[^\u05D0-\u05EA\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

        const words = cleanText.split(' ').filter((w: string) => w.length > 1)
        const searchQuery = words.slice(0, 8).join(' ')

        debugLog.push(`Search query: ${searchQuery}`)

        // Use Sefaria's ElasticSearch API directly (POST with JSON body)
        try {
            const searchBody = {
                size: 10,
                query: {
                    match_phrase: {
                        naive_lemmatizer: {
                            query: searchQuery,
                            slop: 5
                        }
                    }
                }
            }

            debugLog.push(`Calling ElasticSearch API...`)

            const sefariaRes = await fetch('https://www.sefaria.org/api/search/text/_search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(searchBody),
                signal: AbortSignal.timeout(15000)
            })

            debugLog.push(`Sefaria status: ${sefariaRes.status}`)

            if (sefariaRes.ok) {
                const data = await sefariaRes.json() as any
                debugLog.push(`Response keys: ${Object.keys(data).join(', ')}`)

                const hits = data.hits?.hits || []
                debugLog.push(`Hits found: ${hits.length}`)

                for (const hit of hits.slice(0, 5)) {
                    const source = hit._source
                    if (source?.ref) {
                        candidates.push({
                            sourceName: source.ref,
                            sefariaRef: source.ref,
                            previewText: (source.he || source.text || '').substring(0, 100),
                            source: 'Sefaria'
                        })
                    }
                }
            } else {
                const errText = await sefariaRes.text()
                debugLog.push(`Sefaria error: ${errText.substring(0, 200)}`)
            }
        } catch (e) {
            debugLog.push(`Sefaria fetch error: ${e}`)
        }

        // Return results
        if (candidates.length === 0) {
            // Return failure with debug so user sees what happened
            return NextResponse.json({
                success: false,
                error: 'No match found',
                candidates: [{
                    sourceName: 'No match found',
                    sefariaRef: '',
                    previewText: cleanText.substring(0, 150),
                    source: 'OCR Only'
                }],
                ocrText: cleanText.substring(0, 100),
                searchQuery,
                debug: debugLog
            })
        }

        return NextResponse.json({
            success: true,
            candidates,
            ocrText: cleanText.substring(0, 100),
            searchQuery,
            debug: debugLog
        })

    } catch (error) {
        debugLog.push(`Fatal error: ${error}`)
        return NextResponse.json({ success: false, error: String(error), debug: debugLog })
    }
}
