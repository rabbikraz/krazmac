import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

interface SefariaTextResponse {
    ref: string
    heRef: string
    text: string | string[] | string[][]
    he: string | string[] | string[][]
    book: string
    categories: string[]
}

interface SefariaSearchResponse {
    hits?: {
        hits?: Array<{
            _source: {
                ref: string
                heRef: string
                exact?: string
                naive_lemmatizer?: string
            }
            _score: number
        }>
    }
}

// GET: Look up a specific reference
export async function GET(request: NextRequest) {
    const ref = request.nextUrl.searchParams.get('ref')

    if (!ref) {
        return NextResponse.json({ found: false, error: 'No reference provided' })
    }

    try {
        const response = await fetch(
            `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?context=0&pad=0`,
            { headers: { 'Accept': 'application/json' } }
        )

        if (!response.ok) {
            return NextResponse.json({ found: false, ref })
        }

        const data: SefariaTextResponse = await response.json()

        const flattenText = (t: string | string[] | string[][]): string => {
            if (!t) return ''
            if (typeof t === 'string') return t
            if (Array.isArray(t)) return t.map(item => flattenText(item as string | string[])).filter(Boolean).join(' ')
            return ''
        }

        return NextResponse.json({
            found: true,
            ref: data.ref,
            heRef: data.heRef,
            text: flattenText(data.text),
            he: flattenText(data.he),
            url: `https://www.sefaria.org/${encodeURIComponent(data.ref)}`,
            book: data.book,
            categories: data.categories
        })

    } catch (error) {
        return NextResponse.json({ found: false, error: String(error) })
    }
}

// POST: Search for text
export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as { query?: string }
        const query = body.query

        if (!query || query.length < 3) {
            return NextResponse.json({ results: [] })
        }

        const response = await fetch(
            `https://www.sefaria.org/api/search-wrapper/${encodeURIComponent(query)}?size=5&type=text`,
            { headers: { 'Accept': 'application/json' } }
        )

        if (!response.ok) {
            return NextResponse.json({ results: [] })
        }

        const data: SefariaSearchResponse = await response.json()

        const results = (data.hits?.hits || []).map(hit => ({
            ref: hit._source.ref,
            heRef: hit._source.heRef,
            text: hit._source.exact || hit._source.naive_lemmatizer || '',
            score: hit._score,
            url: `https://www.sefaria.org/${encodeURIComponent(hit._source.ref)}`
        }))

        return NextResponse.json({ results })

    } catch (error) {
        return NextResponse.json({ results: [], error: String(error) })
    }
}
