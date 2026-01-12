import { NextRequest, NextResponse } from 'next/server'
// import sharp from 'sharp'

export async function POST(request: NextRequest) {
    return NextResponse.json({
        error: 'Image processing disabled on Edge runtime (Sharp incompatibility)'
    }, { status: 501 })
}

async function findBreakPoints(imageBuffer: Buffer) {
    return [{ title: 'Source 1', box_2d: [0, 0, 1000, 1000] }]
}

function findGaps(brightness: number[], threshold: number, minSize: number) {
    const gaps: { start: number; end: number; center: number }[] = []
    let gapStart = -1

    for (let i = 0; i < brightness.length; i++) {
        const isWhite = brightness[i] > threshold

        if (isWhite && gapStart === -1) {
            gapStart = i
        } else if (!isWhite && gapStart !== -1) {
            const gapEnd = i
            if (gapEnd - gapStart >= minSize) {
                gaps.push({
                    start: gapStart,
                    end: gapEnd,
                    center: Math.floor((gapStart + gapEnd) / 2)
                })
            }
            gapStart = -1
        }
    }

    return gaps
}
