'use client'

import { useState } from 'react'
import { Plus, Search, Book, ExternalLink, Check, Trash2, Loader2, BookOpen } from 'lucide-react'

interface Source {
    id: string
    text: string
    sefariaRef?: string
    sefariaText?: string
    isSearching?: boolean
}

export default function SourceManager() {
    const [sources, setSources] = useState<Source[]>([])
    const [newSourceText, setNewSourceText] = useState('')

    const addSource = () => {
        if (!newSourceText.trim()) return

        const newSource: Source = {
            id: crypto.randomUUID(),
            text: newSourceText.trim()
        }

        setSources(prev => [...prev, newSource])
        setNewSourceText('')
    }

    const removeSource = (id: string) => {
        setSources(prev => prev.filter(s => s.id !== id))
    }

    const searchSefaria = async (sourceId: string, query: string) => {
        setSources(prev => prev.map(s =>
            s.id === sourceId ? { ...s, isSearching: true } : s
        ))

        try {
            // Use Sefaria's search API
            const searchRes = await fetch(`https://www.sefaria.org/api/search-wrapper`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    type: 'text',
                    field: 'naive_lemmatizer',
                    size: 1
                })
            })

            const searchData = await searchRes.json() as any

            if (searchData.hits?.hits?.length > 0) {
                const hit = searchData.hits.hits[0]._source
                const ref = hit.ref

                // Get the full text
                const textRes = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?context=0`)
                const textData = await textRes.json() as any

                setSources(prev => prev.map(s =>
                    s.id === sourceId ? {
                        ...s,
                        sefariaRef: ref,
                        sefariaText: Array.isArray(textData.he) ? textData.he.join(' ') : textData.he,
                        isSearching: false
                    } : s
                ))
            } else {
                setSources(prev => prev.map(s =>
                    s.id === sourceId ? { ...s, isSearching: false } : s
                ))
                alert('No results found in Sefaria')
            }
        } catch (error) {
            console.error('Sefaria search error:', error)
            setSources(prev => prev.map(s =>
                s.id === sourceId ? { ...s, isSearching: false } : s
            ))
            alert('Error searching Sefaria')
        }
    }

    const copyFormatted = () => {
        const formatted = sources.map((s, i) => {
            let text = `${i + 1}. ${s.text}`
            if (s.sefariaRef) {
                text += `\n   📚 ${s.sefariaRef}`
            }
            if (s.sefariaText) {
                text += `\n   ${s.sefariaText}`
            }
            return text
        }).join('\n\n')

        navigator.clipboard.writeText(formatted)
        alert('Sources copied to clipboard!')
    }

    return (
        <div className="space-y-8">
            {/* Add Source Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Add Source
                </h3>

                <div className="space-y-4">
                    <textarea
                        value={newSourceText}
                        onChange={(e) => setNewSourceText(e.target.value)}
                        placeholder="Paste or type a source reference here (e.g., 'Bereishis 1:1' or 'רמב״ם הלכות תשובה פרק א')..."
                        className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-primary text-lg"
                        dir="auto"
                    />

                    <button
                        onClick={addSource}
                        disabled={!newSourceText.trim()}
                        className="w-full md:w-auto px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Add Source
                    </button>
                </div>
            </div>

            {/* Sources List */}
            {sources.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-primary" />
                            Sources ({sources.length})
                        </h3>
                        <button
                            onClick={copyFormatted}
                            className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
                        >
                            Copy All Formatted
                        </button>
                    </div>

                    <div className="space-y-4">
                        {sources.map((source, index) => (
                            <div
                                key={source.id}
                                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm">
                                        {index + 1}
                                    </div>

                                    <div className="flex-1 space-y-4">
                                        {/* Original Text */}
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
                                                Source Text
                                            </label>
                                            <p className="text-lg text-gray-900 font-serif leading-relaxed" dir="auto">
                                                {source.text}
                                            </p>
                                        </div>

                                        {/* Sefaria Result */}
                                        {source.sefariaRef && (
                                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Check className="w-4 h-4 text-green-600" />
                                                    <a
                                                        href={`https://www.sefaria.org/${encodeURIComponent(source.sefariaRef)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm font-semibold text-blue-700 hover:underline flex items-center gap-1"
                                                    >
                                                        {source.sefariaRef}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                                {source.sefariaText && (
                                                    <p className="text-gray-800 font-serif text-right leading-relaxed" dir="rtl">
                                                        {source.sefariaText}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => searchSefaria(source.id, source.text)}
                                                disabled={source.isSearching}
                                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#212f4d] rounded-lg hover:bg-[#212f4d]/90 transition-colors disabled:opacity-50"
                                            >
                                                {source.isSearching ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Search className="w-4 h-4" />
                                                )}
                                                {source.isSearching ? 'Searching...' : 'Find in Sefaria'}
                                            </button>

                                            <a
                                                href={`https://hebrewbooks.org/search?c=1&q=${encodeURIComponent(source.text.substring(0, 50))}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                            >
                                                <Book className="w-4 h-4" />
                                                Search HebrewBooks
                                            </a>

                                            <button
                                                onClick={() => removeSource(source.id)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors ml-auto"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {sources.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No sources added yet</p>
                    <p className="text-sm">Add a source above to get started</p>
                </div>
            )}
        </div>
    )
}
