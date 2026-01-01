import { NextRequest, NextResponse } from 'next/server'

// Simplified: just return the image, let user manually crop
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file' }, { status: 400 })
        }

        const bytes = await file.arrayBuffer()
        const base64 = Buffer.from(bytes).toString('base64')
        const mimeType = file.type.startsWith('image/') ? file.type : 'image/png'

        // Just return the image - user will manually split
        return NextResponse.json({
            success: true,
            image: `data:${mimeType};base64,${base64}`,
            // Default: one source covering the whole page
            regions: [{ title: 'Source 1', y: 0, height: 100 }]
        })
    } catch (error) {
        console.error('Error:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
