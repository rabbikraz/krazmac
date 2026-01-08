import { NextRequest, NextResponse } from 'next/server'

// We use the REST API directly to avoid 'grpc' issues in Cloudflare/Edge environments
const GOOGLE_CLOUD_API_KEY = process.env.GOOGLE_CLOUD_API_KEY || 'AIzaSyAEXa4oYvoHXYUqRq-8UTEOUd9mQd-Va8I'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const imageFile = formData.get('image') as File

        if (!imageFile) {
            return NextResponse.json({ success: false, error: 'No image provided' })
        }

        console.log('--- Starting Identification with Google Vision REST API ---')

        // 1. Convert to Base64
        const arrayBuffer = await imageFile.arrayBuffer()
        const base64Image = Buffer.from(arrayBuffer).toString('base64')

        // 2. Call Google Vision REST API
        const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_API_KEY}`

        const visionRes = await fetch(visionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [
                    {
                        image: { content: base64Image },
                        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
                    }
                ]
            })
        })

        if (!visionRes.ok) {
            const err = await visionRes.text()
            console.error('Vision API Error:', err)
            throw new Error(`Vision API Failed: ${visionRes.status} ${visionRes.statusText}`)
        }

        const visionData = await visionRes.json() as any
        const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text

        if (!fullText) {
            console.log('Vision found no text.')
            return NextResponse.json({ success: false, error: 'No text detected in image' })
        }

        console.log(`OCR Complete. Found ${fullText.length} chars.`)

        // 3. Clean up text for Sefaria Search
        // Strategy: 
        // 1. Remove Nikkud (vowels) if present, as it messes up search
        // 2. Remove common garbage characters
        // 3. Take a solid chunk of text (5-15 words) from the MIDDLE if possible to avoid headers

        let cleanText = fullText.replace(/[\u0591-\u05C7]/g, '') // Remove Nikkud
            .replace(/[^\u05D0-\u05EA\s]/g, ' ') // Keep only Hebrew letters and spaces
            .replace(/\s+/g, ' ')
            .trim()

        // If text is very long, try to skip the first few words which might be headers (e.g. "Chapter 1")
        const words = cleanText.split(' ')
        const startIndex = words.length > 20 ? 5 : 0
        const searchQuery = words.slice(startIndex, startIndex + 15).join(' ') // Search 15 words

        console.log(`Searching Sefaria for: "${searchQuery}"`)

        // 4. Search Sefaria
        // Use 'text' index type for body searches
        const sefariaUrl = `https://www.sefaria.org/api/search-wrapper?q=${encodeURIComponent(searchQuery)}&index_type=text&size=10`

        const searchRes = await fetch(sefariaUrl)
        if (!searchRes.ok) {
            throw new Error(`Sefaria Search failed: ${searchRes.status}`)
        }

        const searchData = await searchRes.json() as any

        // 5. Map results
        let candidates: any[] = []

        if (searchData.hits && searchData.hits.hits) {
            candidates = searchData.hits.hits.map((hit: any) => {
                const source = hit._source
                return {
                    sourceName: source.ref,
                    sefariaRef: source.ref,
                    previewText: source.he || source.text || ''
                }
            })
        } else if (Array.isArray(searchData)) {
            candidates = searchData.map((hit: any) => ({
                sourceName: hit.ref || hit.title,
                sefariaRef: hit.ref,
                previewText: hit.he || hit.text
            }))
        }

        // Filter valid
        candidates = candidates.filter(c => c.sourceName && c.sefariaRef)

        console.log(`Found ${candidates.length} candidates.`)

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
