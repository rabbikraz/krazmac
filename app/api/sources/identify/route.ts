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
            debugLog.push('Trying Gemini Pro Vision...')
            try {
                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API_KEY}`,
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

        // Strategy 1: Try find-refs API (POST with JSON body)
        try {
            debugLog.push(`Trying find-refs POST API...`)

            const findRes = await fetch('https://www.sefaria.org/api/find-refs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: cleanText.substring(0, 500),
                    lang: 'he',
                    with_text: false
                }),
                signal: AbortSignal.timeout(15000)
            })
            debugLog.push(`Find-refs status: ${findRes.status}`)

            if (findRes.ok) {
                const findData = await findRes.json() as any
                debugLog.push(`Find-refs keys: ${Object.keys(findData).join(', ')}`)

                // find-refs returns { ref_data: [...] } with matches
                const refData = findData.ref_data || findData.refs || []
                if (Array.isArray(refData) && refData.length > 0) {
                    debugLog.push(`Found ${refData.length} refs`)
                    for (const item of refData.slice(0, 5)) {
                        const refStr = item.ref || item.sefaria_url || (typeof item === 'string' ? item : '')
                        if (refStr) {
                            candidates.push({
                                sourceName: refStr.replace(/_/g, ' '),
                                sefariaRef: refStr,
                                previewText: item.text || searchQuery,
                                source: 'Sefaria'
                            })
                        }
                    }
                }
            }
        } catch (e) {
            debugLog.push(`Find-refs error: ${e}`)
        }

        // Strategy 2: Try search-wrapper with es6 compat
        if (candidates.length === 0) {
            try {
                // Use GET with query params (simpler, might work)
                const searchUrl = `https://www.sefaria.org/api/search-wrapper?query=${encodeURIComponent(searchQuery)}&type=text&size=5&field=naive_lemmatizer&slop=10`
                debugLog.push(`Trying search-wrapper GET...`)

                const searchRes = await fetch(searchUrl, {
                    signal: AbortSignal.timeout(15000)
                })
                debugLog.push(`Search-wrapper GET status: ${searchRes.status}`)

                if (searchRes.ok) {
                    const searchData = await searchRes.json() as any
                    debugLog.push(`Search response keys: ${Object.keys(searchData).join(', ')}`)

                    const hits = searchData.hits?.hits || searchData.results || []
                    if (Array.isArray(hits) && hits.length > 0) {
                        debugLog.push(`Found ${hits.length} hits`)
                        for (const hit of hits.slice(0, 5)) {
                            const source = hit._source || hit
                            const refStr = source.ref || source.title || ''
                            if (refStr) {
                                candidates.push({
                                    sourceName: refStr,
                                    sefariaRef: refStr,
                                    previewText: (source.he || source.text || '').substring(0, 100),
                                    source: 'Sefaria Search'
                                })
                            }
                        }
                    }
                } else {
                    const errText = await searchRes.text()
                    debugLog.push(`Search error: ${errText.substring(0, 100)}`)
                }
            } catch (e) {
                debugLog.push(`Search-wrapper error: ${e}`)
            }
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
