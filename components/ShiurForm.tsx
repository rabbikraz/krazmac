'use client'

import { useState, useEffect } from 'react'

interface Shiur {
  id?: string
  guid?: string
  slug?: string | null
  title?: string
  description?: string | null
  blurb?: string | null
  audioUrl?: string
  sourceDoc?: string | null
  sourcesJson?: string | null
  pubDate?: string
  duration?: string | null
  link?: string | null
  thumbnail?: string | null
  platformLinks?: {
    youtube?: string | null
    youtubeMusic?: string | null
    spotify?: string | null
    apple?: string | null
    amazon?: string | null
    pocket?: string | null
    twentyFourSix?: string | null
    castbox?: string | null
  } | null
}

interface ShiurFormProps {
  shiur?: Shiur | null
  onSuccess: () => void
  onCancel: () => void
}

export default function ShiurForm({ shiur, onSuccess, onCancel }: ShiurFormProps) {
  const [formData, setFormData] = useState({
    guid: shiur?.guid || '',
    slug: shiur?.slug || ((shiur?.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shiur.id)) ? shiur.id : '') || '',
    title: shiur?.title || '',
    description: shiur?.description || '',
    blurb: shiur?.blurb || '',
    audioUrl: shiur?.audioUrl || '',
    sourceDoc: shiur?.sourceDoc || '',
    sourcesJson: (shiur as any)?.sourcesJson || '',
    pubDate: shiur?.pubDate ? new Date(shiur.pubDate).toISOString().split('T')[0] : '',
    duration: shiur?.duration || '',
    link: shiur?.link || '',
    thumbnail: (shiur as any)?.thumbnail || '',
    youtube: shiur?.platformLinks?.youtube || '',
    youtubeMusic: shiur?.platformLinks?.youtubeMusic || '',
    spotify: shiur?.platformLinks?.spotify || '',
    apple: shiur?.platformLinks?.apple || '',
    amazon: shiur?.platformLinks?.amazon || '',
    pocket: shiur?.platformLinks?.pocket || '',
    twentyFourSix: shiur?.platformLinks?.twentyFourSix || '',
    castbox: shiur?.platformLinks?.castbox || '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        guid: formData.guid || undefined,
        slug: formData.slug || undefined,
        title: formData.title,
        description: formData.description || undefined,
        blurb: formData.blurb || undefined,
        audioUrl: formData.audioUrl,
        sourceDoc: formData.sourceDoc || undefined,
        sourcesJson: formData.sourcesJson || undefined,
        pubDate: formData.pubDate || new Date().toISOString(),
        duration: formData.duration || undefined,
        link: formData.link || undefined,
        thumbnail: formData.thumbnail || undefined,
        platformLinks: {
          youtube: formData.youtube || undefined,
          youtubeMusic: formData.youtubeMusic || undefined,
          spotify: formData.spotify || undefined,
          apple: formData.apple || undefined,
          amazon: formData.amazon || undefined,
          pocket: formData.pocket || undefined,
          twentyFourSix: formData.twentyFourSix || undefined,
          castbox: formData.castbox || undefined,
        },
      }

      const url = shiur?.id ? `/api/shiurim/${shiur.id}` : '/api/shiurim'
      const method = shiur?.id ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json() as { error?: string; newId?: string; slug?: string }

      if (!response.ok) {
        setError(data.error || 'Error saving shiur')
        return
      }

      // If the ID was changed to a slug, redirect to the new URL
      const finalId = data.newId || shiur?.id;
      const finalSlug = data.slug || formData.slug;

      if (finalId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalId);
        let redirectPath = '';

        if (finalSlug && !isUuid) { // If there's a slug and the ID isn't a UUID (meaning ID is the slug)
          redirectPath = `/${finalSlug}`;
        } else if (finalSlug) { // If there's a slug and the ID is a UUID
          redirectPath = `/${finalSlug}`; // Assuming slug takes precedence for display URL
        } else { // No slug, use the ID
          redirectPath = `/shiur/${finalId}`;
        }
        window.location.href = `/admin?edit=${finalId}`; // Keep admin edit view for now
        // window.location.href = redirectPath; // This would redirect to the public view
        return;
      }

      onSuccess()
    } catch (error) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-primary">
        {shiur ? 'Edit Shiur' : 'Add New Shiur'}
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GUID *
            </label>
            <input
              type="text"
              value={formData.guid}
              onChange={(e) => setFormData({ ...formData, guid: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom URL Slug
            </label>
            <div className="flex items-center">
              <span className="text-gray-500 text-sm mr-2">/</span>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                placeholder="e.g., dreams"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Optional. Creates a short memorable URL like /dreams</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio URL *
            </label>
            <input
              type="url"
              value={formData.audioUrl}
              onChange={(e) => setFormData({ ...formData, audioUrl: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Publication Date *
            </label>
            <input
              type="date"
              value={formData.pubDate}
              onChange={(e) => setFormData({ ...formData, pubDate: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration
            </label>
            <input
              type="text"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              placeholder="01:23:45"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Link
            </label>
            <input
              type="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* SOURCE DOCUMENTS SECTION */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            📄 Source Documents
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PDF Source */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-medium text-blue-800 mb-2">
                📎 PDF Source URL
              </label>
              <input
                type="url"
                value={formData.sourceDoc}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith('sources:') || val.trim().startsWith('[')) {
                    alert("⚠️ It looks like you pasted Clipped Sources data here.\n\nPlease stick this in the 'Clipped Sources' section instead!");
                    return;
                  }
                  setFormData({ ...formData, sourceDoc: val })
                }}
                placeholder="https://drive.google.com/..."
                className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
              <p className="text-xs text-blue-600 mt-2">Original PDF link (Google Drive, Dropbox, etc.)</p>
              {formData.sourceDoc && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sourceDoc: '' })}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  Remove PDF link
                </button>
              )}
            </div>

            {/* Clipped Sources */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <label className="block text-sm font-medium text-green-800 mb-2">
                ✂️ Clipped Sources
              </label>
              <div className="flex items-center gap-2">
                {formData.sourcesJson ? (
                  <>
                    <span className="flex-1 px-4 py-2 bg-green-100 border border-green-300 rounded-lg text-green-700 font-medium flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      Contains Clipped Sources
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete the clipped source data?')) {
                          setFormData({ ...formData, sourcesJson: '' })
                        }
                      }}
                      className="px-3 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 text-sm font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <span className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-400 italic">
                    No clipped sources data
                  </span>
                )}
              </div>
              <p className="text-xs text-green-600 mt-2">
                Use the "Source Clipper" tool to generate and attach sources here.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Thumbnail URL (for WhatsApp/Social sharing)
            </label>
            <input
              type="url"
              value={formData.thumbnail}
              onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Image shown when sharing on WhatsApp, Twitter, etc.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description (HTML)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Blurb (Plain Text)
          </label>
          <textarea
            value={formData.blurb}
            onChange={(e) => setFormData({ ...formData, blurb: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Platform Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                YouTube
              </label>
              <input
                type="url"
                value={formData.youtube}
                onChange={(e) => setFormData({ ...formData, youtube: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                YouTube Music
              </label>
              <input
                type="url"
                value={formData.youtubeMusic}
                onChange={(e) => setFormData({ ...formData, youtubeMusic: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Spotify
              </label>
              <input
                type="url"
                value={formData.spotify}
                onChange={(e) => setFormData({ ...formData, spotify: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Apple Podcasts
              </label>
              <input
                type="url"
                value={formData.apple}
                onChange={(e) => setFormData({ ...formData, apple: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amazon Music
              </label>
              <input
                type="url"
                value={formData.amazon}
                onChange={(e) => setFormData({ ...formData, amazon: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pocket Casts
              </label>
              <input
                type="url"
                value={formData.pocket}
                onChange={(e) => setFormData({ ...formData, pocket: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                24Six
              </label>
              <input
                type="url"
                value={formData.twentyFourSix}
                onChange={(e) => setFormData({ ...formData, twentyFourSix: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Castbox
              </label>
              <input
                type="url"
                value={formData.castbox}
                onChange={(e) => setFormData({ ...formData, castbox: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : shiur ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

