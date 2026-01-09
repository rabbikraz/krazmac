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
            debugLog.push('Trying Gemini 1.5 Pro...')
            try {
                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
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

        // Strategy 1: Try Sefaria's linker/find-refs API (finds citations in text)
        try {
            // Use the linker API which is designed to find references in text
            const linkerUrl = `https://www.sefaria.org/api/linker?text=${encodeURIComponent(cleanText.substring(0, 500))}`
            debugLog.push(`Trying linker API...`)

            const linkerRes = await fetch(linkerUrl, { signal: AbortSignal.timeout(15000) })
            debugLog.push(`Linker status: ${linkerRes.status}`)

            if (linkerRes.ok) {
                const linkerData = await linkerRes.json() as any
                debugLog.push(`Linker response keys: ${Object.keys(linkerData).join(', ')}`)

                // Linker returns refs in various formats
                const refs = linkerData.refs || linkerData.matches || []
                if (refs.length > 0) {
                    debugLog.push(`Found ${refs.length} refs from linker`)
                    for (const ref of refs.slice(0, 5)) {
                        const refStr = typeof ref === 'string' ? ref : ref.ref || ref.url || ''
                        if (refStr) {
                            candidates.push({
                                sourceName: refStr,
                                sefariaRef: refStr,
                                previewText: searchQuery,
                                source: 'Sefaria Linker'
                            })
                        }
                    }
                }
            }
        } catch (e) {
            debugLog.push(`Linker error: ${e}`)
        }

        // Strategy 2: Try find-refs API if linker didn't work
        if (candidates.length === 0) {
            try {
                const findUrl = `https://www.sefaria.org/api/find-refs?text=${encodeURIComponent(cleanText.substring(0, 300))}`
                debugLog.push(`Trying find-refs API...`)

                const findRes = await fetch(findUrl, { signal: AbortSignal.timeout(10000) })
                debugLog.push(`Find-refs status: ${findRes.status}`)

                if (findRes.ok) {
                    const findData = await findRes.json() as any
                    debugLog.push(`Find-refs keys: ${Object.keys(findData).join(', ')}`)

                    const refs = findData.refs || findData.ref_data || []
                    if (refs.length > 0) {
                        debugLog.push(`Found ${refs.length} refs`)
                        for (const ref of refs.slice(0, 5)) {
                            const refStr = typeof ref === 'string' ? ref : ref.ref || ''
                            if (refStr) {
                                candidates.push({
                                    sourceName: refStr,
                                    sefariaRef: refStr,
                                    previewText: searchQuery,
                                    source: 'Sefaria Refs'
                                })
                            }
                        }
                    }
                }
            } catch (e) {
                debugLog.push(`Find-refs error: ${e}`)
            }
        }

        // Strategy 3: Try the bulktext search
        if (candidates.length === 0) {
            try {
                const bulkUrl = `https://www.sefaria.org/api/search-wrapper`
                debugLog.push(`Trying search-wrapper POST...`)

                const bulkRes = await fetch(bulkUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: searchQuery,
                        type: 'text',
                        size: 5
                    }),
                    signal: AbortSignal.timeout(15000)
                })
                debugLog.push(`Search-wrapper POST status: ${bulkRes.status}`)

                if (bulkRes.ok) {
                    const bulkData = await bulkRes.json() as any
                    debugLog.push(`Response keys: ${Object.keys(bulkData).join(', ')}`)

                    const hits = bulkData.hits?.hits || []
                    for (const hit of hits.slice(0, 5)) {
                        const source = hit._source
                        if (source?.ref) {
                            candidates.push({
                                sourceName: source.ref,
                                sefariaRef: source.ref,
                                previewText: (source.he || '').substring(0, 100),
                                source: 'Sefaria'
                            })
                        }
                    }
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
