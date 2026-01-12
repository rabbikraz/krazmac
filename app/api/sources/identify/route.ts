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

interface Candidate {
    sourceName: string
    sefariaRef: string
    previewText: string
    source: string
    score?: number
}

// Helper: Fetch text from Sefaria and compare with OCR/Input
async function verifyCandidate(ref: string, inputHeText: string): Promise<number> {
    try {
        const res = await fetch(`https://www.sefaria.org/api/texts/${ref}?context=0&pad=0`)
        if (!res.ok) return 0
        const data = await res.json()

        // Flatten text
        const flatten = (t: any): string => {
            if (!t) return ''
            if (typeof t === 'string') return t
            if (Array.isArray(t)) return t.map(flatten).join(' ')
            return ''
        }
        const heText = flatten(data.he)
        if (!heText) return 0

        // Normalize both
        const normalize = (s: string) => s.replace(/[\u0591-\u05C7]/g, '').replace(/[^\u05D0-\u05EA]/g, '').trim()
        const normInput = normalize(inputHeText)
        const normRef = normalize(heText)

        // Simple Jaccard-like check or overlap
        // Since input is a fragment, check if normInput is IN normRef
        if (normRef.includes(normInput)) return 1.0 // Perfect subset match

        // If not perfect, check word overlap
        const inputWords = new Set(normInput.match(/.{1,3}/g) || []) // Tri-grams? Or just letters?
        // Let's do simple character overlap for robustness against OCR errors
        let hits = 0
        for (let i = 0; i < normInput.length - 2; i++) {
            const trigram = normInput.substring(i, i + 3)
            if (normRef.includes(trigram)) hits++
        }
        const score = hits / (normInput.length - 2)
        return score // 0 to 1
    } catch {
        return 0
    }
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

        // 1. Get OCR Text FIRST (We need it for verification anyway)
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

            if (visionRes.ok) {
                const visionData = await visionRes.json() as any
                ocrText = visionData.responses?.[0]?.fullTextAnnotation?.text || ''
            }
        } catch (e) {
            debugLog.push(`Vision error: ${e}`)
        }

        // Clean OCR Text for searching/verification
        const cleanOcr = ocrText
            .replace(/[\u0591-\u05C7]/g, '')
            .replace(/[^\u05D0-\u05EA\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

        const candidates: Candidate[] = []

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
                                        { text: `Identify this Hebrew/Aramaic Torah source. Returns ONLY JSON:\n{"candidates":[{"sourceName":"Name","sefariaRef":"Ref","previewText":"First words"}]}` },
                                        { inlineData: { mimeType, data: base64 } }
                                    ]
                                }],
                                generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
                            })
                        }
                    )

                    if ([403, 404, 429].includes(geminiResponse.status)) continue

                    if (geminiResponse.ok) {
                        const geminiData: GeminiResponse = await geminiResponse.json()
                        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
                        const match = responseText.match(/\{[\s\S]*\}/)
                        if (match) {
                            const result = JSON.parse(match[0])
                            if (result.candidates?.length > 0) {
                                for (const c of result.candidates) {
                                    // VERIFY CANDIDATE
                                    let score = 1.0
                                    if (c.sefariaRef && cleanOcr.length > 10) {
                                        score = await verifyCandidate(c.sefariaRef, cleanOcr.substring(0, 50)) // Check first 50 chars match
                                        debugLog.push(`Verified ${c.sefariaRef}: Score ${score.toFixed(2)}`)
                                    }

                                    if (score > 0.3) { // Threshold
                                        candidates.push({
                                            sourceName: c.sourceName || c.sefariaRef || 'Unknown',
                                            sefariaRef: c.sefariaRef || '',
                                            previewText: c.previewText || '',
                                            source: `Gemini (Verified ${Math.round(score * 100)}%)`,
                                            score
                                        })
                                    } else {
                                        debugLog.push(`Rejected low score candidate: ${c.sefariaRef}`)
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    debugLog.push(`Error: ${e}`)
                }
            }
        }

        // ============================================
        // STRATEGY 2: Fallback to ElasticSearch (Improved)
        // ============================================

        if (candidates.length === 0 && cleanOcr.length > 5) {
            debugLog.push('Trying Enhanced ElasticSearch...')

            // Search Logic:
            // 1. Search full text (first 200 chars)
            // 2. If no hits, search middle chunk
            // 3. If no hits, search end chunk

            const chunks = [
                cleanOcr.substring(0, 200),
                cleanOcr.length > 200 ? cleanOcr.substring(200, 400) : null,
                cleanOcr.length > 100 ? cleanOcr.substring(Math.max(0, cleanOcr.length - 200)) : null
            ].filter(Boolean) as string[]

            for (const chunk of chunks) {
                if (candidates.length >= 5) break

                try {
                    const esRes = await fetch('https://www.sefaria.org/api/search/text/_search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: {
                                bool: {
                                    should: [
                                        { match: { exact: { query: chunk, boost: 2 } } },
                                        { match: { naive_lemmatizer: chunk } }
                                    ]
                                }
                            },
                            size: 5
                        }),
                        signal: AbortSignal.timeout(5000)
                    })

                    if (esRes.ok) {
                        const esData = await esRes.json() as any
                        const hits = esData.hits?.hits || []

                        for (const hit of hits) {
                            const ref = hit._source?.ref
                            if (ref && !candidates.some(c => c.sefariaRef === ref)) {
                                candidates.push({
                                    sourceName: ref.replace(/_/g, ' '),
                                    sefariaRef: ref,
                                    previewText: hit._source?.exact || '',
                                    source: 'Sefaria Search',
                                    score: hit._score
                                })
                            }
                        }
                    }
                } catch (e) {
                    debugLog.push(`ES Chunk Error: ${e}`)
                }
            }
        }

        // Return results
        if (candidates.length > 0) {
            // Sort by confidence/score if possible, but usually just return order
            return NextResponse.json({ success: true, candidates, debug: debugLog })
        }

        return NextResponse.json({
            success: false,
            error: 'No sources identified',
            candidates: [{
                sourceName: 'OCR Text (Manual Search Needed)',
                sefariaRef: '',
                previewText: cleanOcr.substring(0, 200),
                source: 'OCR'
            }],
            ocrText: cleanOcr.substring(0, 300),
            debug: debugLog
        })

    } catch (error) {
        debugLog.push(`Fatal: ${error}`)
        return NextResponse.json({ success: false, error: String(error), debug: debugLog })
    }
}
