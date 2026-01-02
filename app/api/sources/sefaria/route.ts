import { NextRequest, NextResponse } from 'next/server'

// Edge runtime for Cloudflare compatibility
export const runtime = 'edge'

interface SefariaText {
    ref: string
    hebrewRef: string
    text: string | string[]
    he: string | string[]
    url: string
}

export async function GET(request: NextRequest) {
    const ref = request.nextUrl.searchParams.get('ref')

    if (!ref) {
        return NextResponse.json({ error: 'No reference provided' }, { status: 400 })
    }

    try {
        // Try to get the source from Sefaria API
        const response = await fetch(
            `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?context=0&pad=0`,
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
        )

        if (!response.ok) {
            // Try search if direct lookup fails
            const searchResponse = await fetch(
                `https://www.sefaria.org/api/search-wrapper/${encodeURIComponent(ref)}?size=5&type=text`,
                {
                    headers: { 'Accept': 'application/json' }
                }
            )

            if (searchResponse.ok) {
                const searchData = await searchResponse.json()
                if (searchData.hits?.hits?.length > 0) {
                    const firstHit = searchData.hits.hits[0]._source
                    return NextResponse.json({
                        found: true,
                        searchResult: true,
                        ref: firstHit.ref,
                        hebrewRef: firstHit.heRef,
                        text: firstHit.exact || firstHit.naive_lemmatizer,
                        url: `https://www.sefaria.org/${encodeURIComponent(firstHit.ref)}`
                    })
                }
            }

            return NextResponse.json({
                found: false,
                error: 'Source not found in Sefaria',
                searchQuery: ref
            })
        }

        const data = await response.json()

        // Flatten nested text arrays
        const flattenText = (t: string | string[]): string => {
            if (Array.isArray(t)) {
                return t.map(flattenText).join(' ')
            }
            return t || ''
        }

        return NextResponse.json({
            found: true,
            ref: data.ref,
            hebrewRef: data.heRef,
            text: flattenText(data.text),
            hebrewText: flattenText(data.he),
            url: `https://www.sefaria.org/${encodeURIComponent(data.ref)}`,
            book: data.book,
            categories: data.categories
        })

    } catch (error) {
        console.error('Sefaria API error:', error)
        return NextResponse.json({
            found: false,
            error: 'Failed to fetch from Sefaria',
            details: String(error)
        }, { status: 500 })
    }
}

// Search endpoint
export async function POST(request: NextRequest) {
    try {
        const { query } = await request.json()

        if (!query) {
            return NextResponse.json({ error: 'No query provided' }, { status: 400 })
        }

        // Search Sefaria for matching texts
        const response = await fetch(
            `https://www.sefaria.org/api/search-wrapper/${encodeURIComponent(query)}?size=10&type=text`,
            {
                headers: { 'Accept': 'application/json' }
            }
        )

        if (!response.ok) {
            return NextResponse.json({ results: [], error: 'Search failed' })
        }

        const data = await response.json()

        const results = (data.hits?.hits || []).map((hit: any) => ({
            ref: hit._source.ref,
            hebrewRef: hit._source.heRef,
            snippet: hit._source.exact || hit._source.naive_lemmatizer,
            score: hit._score,
            url: `https://www.sefaria.org/${encodeURIComponent(hit._source.ref)}`
        }))

        return NextResponse.json({ results })

    } catch (error) {
        console.error('Sefaria search error:', error)
        return NextResponse.json({ results: [], error: String(error) })
    }
}
