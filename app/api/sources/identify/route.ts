import { NextRequest, NextResponse } from 'next/server'

// Use Google Vision REST API
const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_API_KEY || 'AIzaSyAXKKKN7H5WmZjQXipg7ghBQHkIxhVyWN0'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const imageFile = formData.get('image') as File

        if (!imageFile) {
            return NextResponse.json({ success: false, error: 'No image provided' })
        }

        console.log('--- Step 1: OCR with Google Vision ---')

        // Convert to base64
        const arrayBuffer = await imageFile.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')

        // Call Google Vision REST API
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
            const errorText = await visionRes.text()
            console.error('Vision API Error:', errorText)
            return NextResponse.json({
                success: false,
                error: `Vision API Error: ${visionRes.status}`
            })
        }

        const visionData = await visionRes.json() as any
        const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text

        if (!fullText) {
            return NextResponse.json({
                success: false,
                error: 'No text detected in image'
            })
        }

        console.log(`OCR found ${fullText.length} chars`)

        // ============================================
        // Step 2: Clean OCR text for search
        // ============================================

        // Remove nikkud (vowels) and clean up whitespace
        let cleanText = fullText
            .replace(/[\u0591-\u05C7]/g, '') // Remove nikkud/taamim
            .replace(/[^\u05D0-\u05EA\s]/g, ' ') // Keep only Hebrew letters + space
            .replace(/\s+/g, ' ')
            .trim()

        // Take a good search phrase (skip first few words which might be headers)
        const words = cleanText.split(' ').filter((w: string) => w.length > 1)
        const startIdx = words.length > 15 ? 3 : 0
        const searchPhrase = words.slice(startIdx, startIdx + 10).join(' ')

        console.log(`Search phrase: "${searchPhrase}"`)

        const candidates: Array<{ sourceName: string, sefariaRef: string, previewText: string, source?: string }> = []

        // ============================================
        // Step 3: Search Sefaria
        // ============================================

        try {
            const sefariaUrl = `https://www.sefaria.org/api/search-wrapper?q=${encodeURIComponent(searchPhrase)}&type=text&size=5`
            console.log('Searching Sefaria...')
            const sefariaRes = await fetch(sefariaUrl, { signal: AbortSignal.timeout(5000) })

            if (sefariaRes.ok) {
                const sefariaData = await sefariaRes.json() as any
                const hits = sefariaData.hits?.hits || sefariaData || []

                for (const hit of hits.slice(0, 3)) {
                    const source = hit._source || hit
                    if (source.ref) {
                        candidates.push({
                            sourceName: source.ref,
                            sefariaRef: source.ref,
                            previewText: (source.he || source.text || '').substring(0, 100),
                            source: 'Sefaria'
                        })
                    }
                }
                console.log(`Sefaria found ${candidates.length} results`)
            }
        } catch (e) {
            console.error('Sefaria search error:', e)
        }

        // ============================================
        // Step 4: Search HebrewBooks
        // ============================================

        try {
            // HebrewBooks has a search page - we'll use their AJAX endpoint
            const hbUrl = `https://hebrewbooks.org/ajax.ashx?type=search&val=${encodeURIComponent(searchPhrase.substring(0, 50))}`
            console.log('Searching HebrewBooks...')
            const hbRes = await fetch(hbUrl, {
                signal: AbortSignal.timeout(5000),
                headers: { 'Accept': 'application/json' }
            })

            if (hbRes.ok) {
                const hbText = await hbRes.text()
                // HebrewBooks returns HTML or JSON depending on the query
                // Try to extract book references from the response
                const bookMatches = hbText.match(/hebrewbooks\.org\/\d+/g)
                if (bookMatches) {
                    for (const match of bookMatches.slice(0, 2)) {
                        const bookId = match.split('/')[1]
                        candidates.push({
                            sourceName: `HebrewBooks #${bookId}`,
                            sefariaRef: '',
                            previewText: `https://${match}`,
                            source: 'HebrewBooks'
                        })
                    }
                }
            }
        } catch (e) {
            console.error('HebrewBooks search error:', e)
        }

        // ============================================
        // Step 5: Try Sefaria name lookup as fallback
        // ============================================

        if (candidates.length === 0 && searchPhrase.length > 10) {
            try {
                const lookupUrl = `https://www.sefaria.org/api/name/${encodeURIComponent(searchPhrase.substring(0, 50))}`
                const lookupRes = await fetch(lookupUrl, { signal: AbortSignal.timeout(3000) })

                if (lookupRes.ok) {
                    const lookupData = await lookupRes.json() as any
                    if (lookupData.completions) {
                        for (const comp of lookupData.completions.slice(0, 3)) {
                            candidates.push({
                                sourceName: comp,
                                sefariaRef: comp,
                                previewText: searchPhrase,
                                source: 'Sefaria Lookup'
                            })
                        }
                    }
                }
            } catch (e) {
                console.error('Lookup error:', e)
            }
        }

        // ============================================
        // Return results
        // ============================================

        if (candidates.length === 0) {
            return NextResponse.json({
                success: true,
                candidates: [{
                    sourceName: 'OCR Result (no match found)',
                    sefariaRef: '',
                    previewText: cleanText.substring(0, 200),
                    source: 'OCR Only'
                }],
                ocrText: cleanText
            })
        }

        return NextResponse.json({
            success: true,
            candidates,
            ocrText: cleanText.substring(0, 200)
        })

    } catch (error) {
        console.error('Identification Error:', error)
        return NextResponse.json({
            success: false,
            error: String(error)
        })
    }
}
