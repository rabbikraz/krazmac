import { NextRequest, NextResponse } from 'next/server'

// Fallback API key if env not set in Cloudflare
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAEXa4oYvoHXYUqRq-8UTEOUd9mQd-Va8I'
// Alternative key from parse-text route
const GEMINI_API_KEY_ALT = 'AIzaSyBUxKm7aHk1erGj3CPL-Xab8UXSZAWe5IU'
const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_API_KEY || 'AIzaSyAXKKKN7H5WmZjQXipg7ghBQHkIxhVyWN0'

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

        // Convert to base64
        const arrayBuffer = await imageFile.arrayBuffer()
        const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        const mimeType = imageFile.type || 'image/png'

        const candidates: Array<{ sourceName: string, sefariaRef: string, previewText: string, source?: string }> = []

        // ============================================
        // STRATEGY 1: Try Gemini models
        // ============================================

        // Added gemini-2.5-flash based on your availabilty check
        const models = [
            'gemini-2.5-flash',       // Newest stable
            'gemini-2.0-flash-exp',   // Experimental
            'gemini-flash-latest',    // Fallback alias
        ]

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
                                        {
                                            text: `Identify this Hebrew/Aramaic Torah source. Return ONLY JSON:
{"candidates":[{"sourceName":"Name","sefariaRef":"Ref","previewText":"First words"}]}
Examples: "Berakhot 55a", "Rashi on Genesis 1:1"`
                                        },
                                        { inlineData: { mimeType, data: base64 } }
                                    ]
                                }],
                                generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
                            })
                        }
                    )

                    debugLog.push(`${model}: ${geminiResponse.status}`)

                    // 403: Forbidden (key doesn't have access to model), 404: Not Found, 429: Rate Limit
                    if ([403, 404, 429].includes(geminiResponse.status)) {
                        continue
                    }

                    if (geminiResponse.ok) {
                        const geminiData: GeminiResponse = await geminiResponse.json()
                        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

                        try {
                            const match = responseText.match(/\{[\s\S]*\}/)
                            if (match) {
                                const result = JSON.parse(match[0])
                                if (result.candidates?.length > 0) {
                                    for (const c of result.candidates) {
                                        candidates.push({
                                            sourceName: c.sourceName || c.sefariaRef || 'Unknown',
                                            sefariaRef: c.sefariaRef || '',
                                            previewText: c.previewText || '',
                                            source: `Gemini (${model})`
                                        })
                                    }
                                    debugLog.push(`Gemini found ${candidates.length} candidates`)
                                }
                            }
                        } catch (e) {
                            debugLog.push(`Parse error`)
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
        // STRATEGY 2: OCR with Vision API + Sefaria find-refs
        // ============================================

        debugLog.push('Gemini failed, trying OCR + Sefaria...')

        // Step 1: OCR with Google Vision
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
            return NextResponse.json({
                success: false,
                error: 'Could not read text from image',
                debug: debugLog
            })
        }

        // Clean the OCR text - remove nikkud, keep only Hebrew
        const cleanText = ocrText
            .replace(/[\u0591-\u05C7]/g, '')  // Remove nikkud
            .replace(/[^\u05D0-\u05EA\s]/g, ' ')  // Keep only Hebrew letters
            .replace(/\s+/g, ' ')
            .trim()

        // Step 2: Try Sefaria APIs

        // Strategy A: Try find-refs with correct body format AND POLLING
        try {
            debugLog.push('Trying Sefaria find-refs...')

            const sefariaRes = await fetch('https://www.sefaria.org/api/find-refs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: {
                        body: cleanText.substring(0, 500), // Reduce length for faster processing
                        title: ''
                    },
                    lang: 'he'
                }),
                signal: AbortSignal.timeout(15000)
            })

            debugLog.push(`find-refs: ${sefariaRes.status}`)

            if (sefariaRes.ok) {
                const data = await sefariaRes.json() as any

                // Handle async response - might return task_id
                if (data.task_id) {
                    debugLog.push(`Async id: ${data.task_id}, polling...`)

                    // Poll for results (max 5 attempts, 1s apart)
                    for (let i = 0; i < 5; i++) {
                        await new Promise(r => setTimeout(r, 1000))

                        const statusRes = await fetch(`https://www.sefaria.org/api/async/${data.task_id}`)
                        if (statusRes.ok) {
                            const statusData = await statusRes.json() as any
                            if (statusData.state === 'SUCCESS' && statusData.result) {
                                debugLog.push('Async task SUCCESS!')
                                const results = statusData.result.ref_data || statusData.result.refs || []
                                if (results.length > 0) {
                                    for (const item of results.slice(0, 5)) {
                                        const ref = typeof item === 'string' ? item : (item.ref || '')
                                        if (ref) {
                                            candidates.push({
                                                sourceName: ref.replace(/_/g, ' '),
                                                sefariaRef: ref,
                                                previewText: cleanText.substring(0, 80),
                                                source: 'Sefaria'
                                            })
                                        }
                                    }
                                    break // Found results, stop polling
                                }
                            } else {
                                debugLog.push(`Poll ${i + 1}: ${statusData.state}`)
                            }
                        }
                    }
                } else {
                    const refs = data.ref_data || data.refs || data.results || []
                    if (Array.isArray(refs) && refs.length > 0) {
                        for (const item of refs.slice(0, 5)) {
                            const ref = typeof item === 'string' ? item : (item.ref || '')
                            if (ref) {
                                candidates.push({
                                    sourceName: ref.replace(/_/g, ' '),
                                    sefariaRef: ref,
                                    previewText: cleanText.substring(0, 80),
                                    source: 'Sefaria'
                                })
                            }
                        }
                    }
                }
            }
        } catch (e) {
            debugLog.push(`find-refs error: ${e}`)
        }

        // Strategy B: Try name API to match text patterns
        if (candidates.length === 0) {
            try {
                // Extract first few significant Hebrew words for lookup
                const words = cleanText.split(' ').filter((w: string) => w.length > 2).slice(0, 3)
                const searchTerm = words.join(' ')

                debugLog.push(`Trying name API: ${searchTerm.substring(0, 30)}...`)

                const nameRes = await fetch(
                    `https://www.sefaria.org/api/name/${encodeURIComponent(searchTerm)}?limit=5`,
                    { signal: AbortSignal.timeout(10000) }
                )

                debugLog.push(`name API: ${nameRes.status}`)

                if (nameRes.ok) {
                    const nameData = await nameRes.json() as any

                    // Check if it's a valid ref
                    if (nameData.is_ref && nameData.ref) {
                        candidates.push({
                            sourceName: nameData.ref,
                            sefariaRef: nameData.ref,
                            previewText: cleanText.substring(0, 80),
                            source: 'Sefaria Match'
                        })
                    }
                }
            } catch (e) {
                debugLog.push(`name API error: ${e}`)
            }
        }

        // Return results
        if (candidates.length > 0) {
            return NextResponse.json({ success: true, candidates, debug: debugLog })
        }

        // No results - return OCR text for manual identification
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
