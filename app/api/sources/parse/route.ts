import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBUxKm7aHk1erGj3CPL-Xab8UXSZAWe5IU'
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY || 'AIzaSyAXKKKN7H5WmZjQXipg7ghBQHkIxhVyWN0' // Kept for fallback

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size)

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Use Google Vision for OCR
        console.log('Running OCR with Google Vision...')
        const rawText = await ocrWithGoogleVision(buffer, file.type)
        console.log('Extracted text length:', rawText.length)

        if (rawText.length < 10) {
            return NextResponse.json({
                success: true,
                rawText: '',
                sources: [],
                method: 'google_vision',
                note: 'No text was found. The scan may be too blurry, or try adding sources manually.'
            })
        }

        // Simple split: each paragraph or double-newline separated block is a source
        const sources = simpleParseText(rawText)

        return NextResponse.json({
            success: true,
            rawText,
            sources,
            method: 'google_vision'
        })
    } catch (error) {
        console.error('Processing error:', error)
        return NextResponse.json({
            error: 'Failed to process file: ' + (error as Error).message
        }, { status: 500 })
    }
}

// Simple text parsing - just split by double newlines
function simpleParseText(text: string): Array<{ id: string; text: string; type: string; title?: string }> {
    // Split by double newlines or long gaps
    const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(b => b.length > 20)

    return blocks.map((block, i) => {
        const lines = block.split('\n')
        const firstLine = lines[0].trim()
        const hebrewChars = (block.match(/[\u0590-\u05FF]/g) || []).length
        const isHebrew = hebrewChars > block.length * 0.3

        return {
            id: crypto.randomUUID(),
            text: block,
            type: isHebrew ? 'hebrew' : 'english',
            title: firstLine.length < 60 ? firstLine : `Source ${i + 1}`
        }
    })
}

// Use Gemini Vision to read image AND parse sources in one step
async function parseImageWithGemini(base64Image: string, mimeType: string): Promise<Array<{ id: string; text: string; type: string; title?: string }>> {
    try {
        const prompt = `You are an expert in Jewish religious texts and can read Hebrew, Aramaic, and Rashi script perfectly.

Look at this image of a source sheet. Extract EVERY individual source you see.

For each source, provide:
1. title: The source reference exactly as written (e.g., "רש"י על בראשית א:א", "גמרא ברכות ב.", "רמב"ם הל' תשובה")
2. text: The COMPLETE text content of that source - copy it exactly as you see it
3. type: "hebrew" if Hebrew/Aramaic, "english" if English

IMPORTANT: 
- Include ALL sources, even if there are 10, 20, or 40 sources
- Copy the text EXACTLY as it appears, including nikud if present
- If a source has no clear title/reference, describe what it is (e.g., "פירוש על הפסוק")

Return ONLY a valid JSON array, no other text:
[{"title": "...", "text": "...", "type": "hebrew"}, ...]`

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Image
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 8000
                    }
                })
            }
        )

        if (!response.ok) {
            const errText = await response.text()
            console.error('Gemini API error:', response.status, errText)
            return []
        }

        const data = await response.json() as any
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        console.log('Gemini response length:', content.length)

        // Extract JSON from response
        let jsonStr = content.trim()
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        }

        const parsed = JSON.parse(jsonStr)

        return parsed.map((s: any) => ({
            id: crypto.randomUUID(),
            title: s.title || 'Source',
            text: s.text || '',
            type: s.type || 'hebrew'
        }))
    } catch (e) {
        console.error('Gemini Vision parsing error:', e)
        return []
    }
}

// AI-powered parsing using Gemini
async function parseWithGemini(text: string): Promise<Array<{ id: string; text: string; type: string; title?: string }>> {
    try {
        const prompt = `You are an expert in Jewish religious texts. Analyze this Hebrew/Aramaic source sheet text and identify each individual source.

For each source, provide:
1. title: The source reference (e.g., "רש"י על בראשית א:א", "תלמוד בבלי ברכות ב.", "רמב"ם הלכות תשובה פ"א ה"א")
2. text: The actual content of that source
3. type: "hebrew" if mostly Hebrew/Aramaic, "english" if mostly English

Return ONLY a valid JSON array, no other text. Example format:
[{"title": "רש\"י על בראשית א:א", "text": "בראשית - בשביל התורה...", "type": "hebrew"}]

If you cannot identify a specific source reference, use a descriptive title based on content.

Here is the text to parse:
${text.substring(0, 8000)}` // Limit to avoid token limits

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 4000
                    }
                })
            }
        )

        if (!response.ok) {
            console.error('Gemini API error:', response.status)
            return []
        }

        const data = await response.json() as any
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = content.trim()
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        }

        const parsed = JSON.parse(jsonStr)

        // Add IDs to each source
        return parsed.map((s: any) => ({
            id: crypto.randomUUID(),
            title: s.title || 'Untitled Source',
            text: s.text || '',
            type: s.type || 'hebrew'
        }))
    } catch (e) {
        console.error('Gemini parsing error:', e)
        return []
    }
}

async function identifySefariaSource(source: { id: string; text: string; type: string; title?: string }) {
    // Candidates for lookup: Title, or First Line of text
    const candidates: string[] = []

    if (source.title) candidates.push(source.title)

    // Always add first line of text as a candidate, trimmed
    const lines = source.text.split('\n')
    const firstLine = lines[0].trim()
    if (firstLine && firstLine !== source.title) {
        candidates.push(firstLine)
    }

    for (const rawCandidate of candidates) {
        if (rawCandidate.length < 2) continue

        // clean title for Sefaria
        // Remove "Source 1:", "Mekor 1", "1.", "(1)", etc
        let cleanCandidate = rawCandidate
            .replace(/^(Source|Mekor|מקור|SOURCE)\s+[\dא-ת]+[:\.\)\-\s]*/i, '') // Remove "Source 1:"
            .replace(/^[\dא-ת]+[\.\)\-\s]+/, '') // Remove "1." or "א."
            .replace(/[\\(\)]/g, '') // Remove parens
            .trim()

        // If cleaning killed it (e.g. it was just "1."), skip
        if (cleanCandidate.length < 2) continue

        try {
            // Check Sefaria
            const response = await fetch(`https://www.sefaria.org/api/name/${encodeURIComponent(cleanCandidate)}`)
            if (!response.ok) continue

            const data = await response.json() as any

            // If it's a known ref or index or book
            if (data.is_ref || data.is_index || data.is_book) {
                console.log(`Identified: ${cleanCandidate} -> ${data.ref || data.primary_category}`)
                return {
                    ...source,
                    title: data.hebrew || data.primary_category ? `${data.primary_category || data.ref} - ${cleanCandidate}` : cleanCandidate,
                    sefariaRef: data.ref || cleanCandidate,
                    hebrewTitle: data.hebrew,
                    category: data.primary_category,
                    link: data.ref ? `https://www.sefaria.org/${data.ref}` : undefined
                }
            }
        } catch (e) {
            console.error('Sefaria lookup failed:', e)
        }
    }

    return source
}



async function ocrWithGoogleVision(buffer: Buffer, mimeType: string): Promise<string> {
    const base64Content = buffer.toString('base64')

    const requestBody = {
        requests: [
            {
                image: {
                    content: base64Content
                },
                features: [
                    {
                        type: 'DOCUMENT_TEXT_DETECTION'
                    }
                ],
                imageContext: {
                    languageHints: ['he', 'en', 'yi'] // Hebrew, English, Yiddish
                }
            }
        ]
    }

    console.log('Calling Google Vision API...')

    const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        }
    )

    const data = await response.json() as any

    console.log('Google Vision response status:', response.status)

    if (!response.ok) {
        console.error('Google Vision API error:', JSON.stringify(data).substring(0, 500))
        throw new Error(`Google Vision error: ${data.error?.message || response.statusText}`)
    }

    if (data.responses?.[0]?.error) {
        throw new Error(`Vision API error: ${data.responses[0].error.message}`)
    }

    const fullText = data.responses?.[0]?.fullTextAnnotation?.text || ''

    if (!fullText) {
        console.log('No text detected in file')
    }

    return fullText
}

function parseSourcesFromText(text: string): Array<{ id: string; text: string; type: string; title?: string }> {
    if (!text.trim()) return []

    const sources: Array<{ id: string; text: string; type: string; title?: string }> = []

    // Normalize newlines
    const cleanText = text.replace(/\r\n/g, '\n')

    // Regex to find source starters:
    // 1. "Source 1", "Mekor 1", "מקור 1", "מקור א"
    // 2. Numbered list: "1.", "1)", "(1)", "א.", "א)", "(א)", "1-", "א-"
    // 3. Common headers: "Rashi", "Tosafot", "Gemara", etc.

    const sourceSplitRegex = new RegExp(
        // Explicit "Source X" or "Mekor X"
        '(?=\\n(?:Source|Mekor|מקור|SOURCE)\\s+[\\dא-ת]+)|' +
        // Numbered list (e.g. "1.", "1)", "(1)", "א.", "א)", "1 -")
        '(?=\\n(?:\\d+|[א-ת])[\\.\\)\\-] )|' +
        '(?=\\n\\((?:\\d+|[א-ת])\\))|' +
        // Common Hebrew headers at start of line
        '(?=\\n(?:רמב"?ם|גמרא|משנה|שו"?ע|רש"?י|תוספות|מדרש|פרק|דף|סעיף|הלכה|siman|seif)\\s+)',
        'g'
    );

    // If we can't find clear source indicators, fall back to double newline
    let blocks: string[] = []

    // Check if we have enough splits. If it finds < 2 splits on a large text, it might be failing.
    const splitCheck = cleanText.split(sourceSplitRegex)

    if (splitCheck.length > 3) {
        console.log(`Detected structured sources (${splitCheck.length} blocks), splitting by pattern...`)
        blocks = splitCheck.filter(b => b.trim().length > 5)
    } else {
        console.log('No clear structure detected with regex, checking for short header lines...')

        // Alternative strategy: Look for short lines that look like headers
        // Split by double newline OR by short header-like lines
        blocks = cleanText.split(/\n{2,}/)

        // If blocks are still huge (>2000 chars), try splitting by any short line
        if (blocks.some(b => b.length > 2000)) {
            // Logic: Split on any single newline where the NEXT line is short (<3 words)? 
            // That's risky. Let's stick to the Regex but try to be looser.
            console.log('Blocks are huge, falling back to simple newline split for safety')
            blocks = cleanText.split(/\n+/).reduce((acc: string[], line) => {
                if (acc.length === 0) return [line]
                const last = acc[acc.length - 1]
                // If previous block is long and this line looks like a start, split
                if (last.length > 500 && line.length < 50) {
                    acc.push(line)
                } else {
                    acc[acc.length - 1] += '\n' + line
                }
                return acc
            }, [])
        }
    }

    blocks.forEach((block) => {
        const trimmedBlock = block.trim()
        const hebrewChars = (trimmedBlock.match(/[\u0590-\u05FF]/g) || []).length
        const totalAlphaChars = (trimmedBlock.match(/[a-zA-Z\u0590-\u05FF]/g) || []).length
        const isHebrew = totalAlphaChars > 0 && (hebrewChars / totalAlphaChars) > 0.5

        const lines = trimmedBlock.split('\n')
        let title = ''
        let content = trimmedBlock

        // extract title from first line
        if (lines.length > 0) {
            const firstLine = lines[0].trim()
            // Check if first line is short and looks like a header/number
            if (firstLine.length < 50 && (
                /^(Source|Mekor|מקור|SOURCE)\s+[\dא-ת]+/.test(firstLine) ||
                /^(\d+|[א-ת])[\.\)]/.test(firstLine) ||
                /^\((?:\d+|[א-ת])\)/.test(firstLine) ||
                /רמב"ם|גמרא|משנה|שו"ע|רש"י|תוספות|מדרש|פרק|דף/.test(firstLine)
            )) {
                title = firstLine
                content = lines.slice(1).join('\n').trim()
            }
        }

        sources.push({
            id: crypto.randomUUID(),
            text: content || trimmedBlock,
            type: isHebrew ? 'hebrew' : 'english',
            title: title || undefined
        })
    })

    return sources
}
