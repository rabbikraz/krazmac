import { NextRequest, NextResponse } from 'next/server'

// API Keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAEXa4oYvoHXYUqRq-8UTEOUd9mQd-Va8I'
const GEMINI_API_KEY_ALT = 'AIzaSyBUxKm7aHk1erGj3CPL-Xab8UXSZAWe5IU'
const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_API_KEY || 'AIzaSyAXKKKN7H5WmZjQXipg7ghBQHkIxhVyWN0'

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>
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

        // Convert to base64
        const arrayBuffer = await imageFile.arrayBuffer()
        const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        const mimeType = imageFile.type || 'image/png'

        const candidates: Array<{ sourceName: string, sefariaRef: string, previewText: string, source?: string }> = []

        // ============================================
        // STRATEGY 1: Try Gemini AI
        // ============================================

        const models = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-flash-latest']
        const apiKeys = [GEMINI_API_KEY, GEMINI_API_KEY_ALT]

        for (const apiKey of apiKeys) {
            if (candidates.length > 0) break
            for (const model of models) {
                if (candidates.length > 0) break

                debugLog.push(`Trying ${model}...`)
                try {
                    const geminiResponse = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        { text: `Identify this Hebrew/Aramaic Torah source. Return ONLY JSON:\n{"candidates":[{"sourceName":"Name","sefariaRef":"Ref","previewText":"First words"}]}` },
                                        { inlineData: { mimeType, data: base64 } }
                                    ]
                                }],
                                generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
                            })
                        }
                    )

                    debugLog.push(`${model}: ${geminiResponse.status}`)

                    if ([403, 404, 429].includes(geminiResponse.status)) continue

                    if (geminiResponse.ok) {
                        const geminiData: GeminiResponse = await geminiResponse.json()
                        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
                        const match = responseText.match(/\{[\s\S]*\}/)
                        if (match) {
                            const result = JSON.parse(match[0])
                            if (result.candidates?.length > 0) {
                                for (const c of result.candidates) {
                                    candidates.push({
                                        sourceName: c.sourceName || c.sefariaRef || 'Unknown',
                                        sefariaRef: c.sefariaRef || '',
                                        previewText: c.previewText || '',
                                        source: 'Gemini'
                                    })
                                }
                                debugLog.push(`Gemini found ${candidates.length} candidates`)
                            }
                        }
                    }
                } catch (e) {
                    debugLog.push(`Error: ${e}`)
                }
            }
        }

        if (candidates.length > 0) {
            return NextResponse.json({ success: true, candidates, debug: debugLog })
        }

        // ============================================
        // STRATEGY 2: OCR + Sefaria ElasticSearch
        // ============================================

        debugLog.push('Gemini failed, trying OCR + Sefaria...')

        // OCR with Google Vision
        let ocrText = ''
        try {
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

            debugLog.push(`Vision: ${visionRes.status}`)

            if (visionRes.ok) {
                const visionData = await visionRes.json() as any
                ocrText = visionData.responses?.[0]?.fullTextAnnotation?.text || ''
                debugLog.push(`OCR: ${ocrText.length} chars`)
            }
        } catch (e) {
            debugLog.push(`Vision error: ${e}`)
        }

        if (!ocrText) {
            return NextResponse.json({ success: false, error: 'Could not read text', debug: debugLog })
        }

        // Clean text
        const cleanText = ocrText
            .replace(/[\u0591-\u05C7]/g, '')
            .replace(/[^\u05D0-\u05EA\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

        // Sefaria ElasticSearch (WORKS!)
        try {
            debugLog.push('Trying Sefaria ElasticSearch...')

            const esRes = await fetch('https://www.sefaria.org/api/search/text/_search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: { match: { naive_lemmatizer: cleanText.substring(0, 200) } },
                    size: 5
                }),
                signal: AbortSignal.timeout(15000)
            })

            debugLog.push(`ES: ${esRes.status}`)

            if (esRes.ok) {
                const esData = await esRes.json() as any
                const hits = esData.hits?.hits || []
                debugLog.push(`Found ${hits.length} hits`)

                for (const hit of hits.slice(0, 5)) {
                    const ref = hit._source?.ref
                    if (ref) {
                        const baseRef = ref.split(':')[0]
                        if (!candidates.some(c => c.sefariaRef.startsWith(baseRef))) {
                            candidates.push({
                                sourceName: ref.replace(/_/g, ' '),
                                sefariaRef: ref,
                                previewText: hit._source?.exact || cleanText.substring(0, 80),
                                source: 'Sefaria'
                            })
                        }
                    }
                }
            }
        } catch (e) {
            debugLog.push(`ES error: ${e}`)
        }

        // Return results
        if (candidates.length > 0) {
            return NextResponse.json({ success: true, candidates, debug: debugLog })
        }

        return NextResponse.json({
            success: false,
            error: 'No sources identified',
            candidates: [{
                sourceName: 'OCR Text (manual identification needed)',
                sefariaRef: '',
                previewText: cleanText.substring(0, 200),
                source: 'OCR'
            }],
            ocrText: cleanText.substring(0, 300),
            debug: debugLog
        })

    } catch (error) {
        debugLog.push(`Fatal: ${error}`)
        return NextResponse.json({ success: false, error: String(error), debug: debugLog })
    }
}
