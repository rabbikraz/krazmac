'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Edit, Trash2, RefreshCw, LogOut } from 'lucide-react'
import ShiurForm from './ShiurForm'

interface Shiur {
  id: string
  guid: string
  title: string
  description?: string | null
  blurb?: string | null
  audioUrl: string
  sourceDoc?: string | null
  pubDate: string
  duration?: string | null
  link?: string | null
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

export default function AdminDashboard() {
  const [shiurim, setShiurim] = useState<Shiur[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [editingShiur, setEditingShiur] = useState<Shiur | null>(null)
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchShiurim()
  }, [])

  const fetchShiurim = async () => {
    try {
      const response = await fetch('/api/shiurim')
      const data = await response.json()
      setShiurim(data)
    } catch (error) {
      console.error('Error fetching shiurim:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/rss/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await response.json()

      if (response.ok) {
        alert(`Synced ${data.synced} shiurim. ${data.errors} errors.`)
        fetchShiurim()
      } else {
        alert('Error syncing RSS feed: ' + data.error)
      }
    } catch (error) {
      alert('Error syncing RSS feed')
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shiur?')) return

    try {
      const response = await fetch(`/api/shiurim/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchShiurim()
      } else {
        alert('Error deleting shiur')
      }
    } catch (error) {
      alert('Error deleting shiur')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' })
      router.push('/admin')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync RSS'}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">All Shiurim ({shiurim.length})</h2>
          <button
            onClick={() => {
              setEditingShiur(null)
              setShowForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Shiur
          </button>
        </div>

        {showForm && (
          <div className="mb-8">
            <ShiurForm
              shiur={editingShiur}
              onSuccess={() => {
                setShowForm(false)
                setEditingShiur(null)
                fetchShiurim()
              }}
              onCancel={() => {
                setShowForm(false)
                setEditingShiur(null)
              }}
            />
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shiurim.map((shiur) => (
                  <tr key={shiur.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 max-w-md truncate">
                        {shiur.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(shiur.pubDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {shiur.duration || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingShiur(shiur)
                            setShowForm(true)
                          }}
                          className="text-primary hover:text-primary/80"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(shiur.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

