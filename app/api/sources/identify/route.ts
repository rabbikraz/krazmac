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
        // Take first ~150 chars, cleaning up extra whitespace
        const cleanText = fullText.replace(/\s+/g, ' ').trim()
        const searchQuery = cleanText.substring(0, 150)

        console.log(`Searching Sefaria for: "${searchQuery.substring(0, 50)}..."`)

        // 4. Search Sefaria
        const sefariaUrl = `https://www.sefaria.org/api/search-wrapper?q=${encodeURIComponent(searchQuery)}&index_type=text&size=5`

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
