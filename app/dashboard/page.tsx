'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ContentCalendarItem, User } from '@/lib/types/database'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientBranding, ClientHeader } from '@/components/client-branding'
import { LogOut, Download, Copy, MessageCircle, Loader2, Upload, ExternalLink } from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'

export default function DashboardPage() {
  const [calendarData, setCalendarData] = useState<ContentCalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [commentModal, setCommentModal] = useState<{ 
    isOpen: boolean; 
    itemId: string; 
    comments: string[];
    newComment: string;
  }>({
    isOpen: false,
    itemId: '',
    comments: [],
    newComment: ''
  })
  const [updating, setUpdating] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  console.log(user);

  useEffect(() => {
    getUser()
    fetchCalendarData()
  }, [])

  const getUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      // Fetch full user profile - user IS the client now
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      console.log(userProfile);
      
      if (userProfile) {
        setUser(userProfile)
      }
    }
  }

  const fetchCalendarData = async () => {
    try {
      const response = await fetch('/api/calendar')
      const result = await response.json()
      
      if (response.ok) {
        setCalendarData(result.data || [])
      } else {
        // Handle different error types
        if (response.status === 404) {
          if (result.error && result.error.includes('Database tables not set up')) {
            setError(result.error)
          } else {
            setCalendarData([]) // Empty array for no data
          }
        } else {
          setError(result.error || 'Failed to fetch calendar data')
        }
      }
    } catch (err) {
      setError('Failed to fetch calendar data')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const updateCalendarItem = async (id: string, updates: Partial<ContentCalendarItem>) => {
    setUpdating(id)
    try {
      const response = await fetch(`/api/calendar/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const result = await response.json()
        setCalendarData(prev => 
          prev.map(item => item.id === id ? result.data : item)
        )
      } else {
        const error = await response.json()
        alert('Failed to update: ' + error.error)
      }
    } catch (err) {
      alert('Failed to update item')
    } finally {
      setUpdating(null)
    }
  }

  const handleCopyCaption = async (copy: string) => {
    try {
      await copyToClipboard(copy)
      // You could add a toast notification here
    } catch (err) {
      alert('Failed to copy to clipboard')
    }
  }

  const openCommentModal = (itemId: string, currentComments: string[]) => {
    setCommentModal({ 
      isOpen: true, 
      itemId, 
      comments: currentComments || [],
      newComment: ''
    })
  }

  const addComment = async () => {
    if (commentModal.itemId && commentModal.newComment.trim()) {
      const updatedComments = [...commentModal.comments, commentModal.newComment.trim()]
      await updateCalendarItem(commentModal.itemId, { comments: updatedComments })
      setCommentModal({ 
        isOpen: false, 
        itemId: '', 
        comments: [],
        newComment: ''
      })
    }
  }

  const getStatusCounts = () => {
    const teamCounts = {
      'not-started': 0,
      'in-progress': 0,
      'ready-review': 0,
      'ready-post': 0
    }
    
    const clientCounts = {
      'not-submitted': 0,
      'under-review': 0,
      'approved': 0,
      'needs-changes': 0
    }
    
    calendarData.forEach(item => {
      teamCounts[item.team_status]++
      clientCounts[item.client_status]++
    })
    
    return { teamCounts, clientCounts }
  }

  const { teamCounts, clientCounts } = getStatusCounts()

  // CSV Upload Function
  const handleCSVUpload = async (file: File) => {
    setUploading(true)
    try {
      const text = await file.text()
      
      // Parse CSV properly handling quoted fields with commas and newlines
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        let i = 0
        
        while (i < line.length) {
          const char = line[i]
          
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              // Escaped quote
              current += '"'
              i += 2
            } else {
              // Toggle quote state
              inQuotes = !inQuotes
              i++
            }
          } else if (char === ',' && !inQuotes) {
            // Field separator
            result.push(current.trim())
            current = ''
            i++
          } else {
            current += char
            i++
          }
        }
        
        result.push(current.trim())
        return result
      }
      
      // Split text into lines, but handle multi-line quoted fields
      const lines: string[] = []
      let currentLine = ''
      let inQuotes = false
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        
        if (char === '"') {
          inQuotes = !inQuotes
        }
        
        if (char === '\n' && !inQuotes) {
          if (currentLine.trim()) {
            lines.push(currentLine.trim())
          }
          currentLine = ''
        } else {
          currentLine += char
        }
      }
      
      if (currentLine.trim()) {
        lines.push(currentLine.trim())
      }
      
      if (lines.length === 0) {
        throw new Error('No data found in CSV')
      }
      
      const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ''))
      
      const csvData = lines.slice(1).map(line => {
        const values = parseCSVLine(line).map(v => v.replace(/^"|"$/g, ''))
        const item: any = {}
        
        headers.forEach((header, index) => {
          const value = values[index] || ''
          
          // Map CSV headers to database fields
          switch (header.toLowerCase()) {
            case 'date':
              item.date = value
              break
            case 'day':
              item.day = value
              break
            case 'platform':
              item.platform = value.split('|').map(p => p.trim()).filter(p => p)
              break
            case 'type':
              item.type = value
              break
            case 'team_status':
            case 'team status':
              // Validate and normalize team status values
              const validTeamStatuses = ['not-started', 'in-progress', 'ready-review', 'ready-post']
              const normalizedTeamStatus = value.toLowerCase().replace(/\s+/g, '-')
              item.team_status = validTeamStatuses.includes(normalizedTeamStatus) ? normalizedTeamStatus : 'not-started'
              break
            case 'client_status':
            case 'client status':
              // Validate and normalize client status values
              const validClientStatuses = ['not-submitted', 'under-review', 'approved', 'needs-changes']
              const normalizedClientStatus = value.toLowerCase().replace(/\s+/g, '-')
              item.client_status = validClientStatuses.includes(normalizedClientStatus) ? normalizedClientStatus : 'not-submitted'
              break
            case 'hook':
              item.hook = value
              break
            case 'copy':
            case 'caption':
            case 'content':
            case 'text':
              item.copy = value
              break
            case 'kpi':
              item.kpi = value
              break
            case 'image_prompt_1':
            case 'image prompt 1':
            case 'imageprompt1':
            case 'prompt1':
            case 'prompt 1':
              item.image_prompt_1 = value
              break
            case 'image_prompt_2':
            case 'image prompt 2':
            case 'imageprompt2':
            case 'prompt2':
            case 'prompt 2':
              item.image_prompt_2 = value
              break
            case 'comments':
            case 'comment':
            case 'notes':
            case 'note':
              // Handle comments - convert string to array if needed
              if (value) {
                item.comments = Array.isArray(value) ? value : [value]
              } else {
                item.comments = []
              }
              break
            default:
              // Handle any other fields
              item[header.toLowerCase().replace(/\s+/g, '_')] = value
          }
        })
        
        // Set defaults
        item.is_new = true
        if (!item.comments) {
          item.comments = []
        }
        
        return item
      }).filter(item => item.date && item.hook) // Only include rows with date and hook
      
      // Upload to database
      const response = await fetch('/api/calendar/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: csvData }),
      })

      if (response.ok) {
        const result = await response.json()
        
        // Update the calendar data with the new items
        setCalendarData(result.data || [])
        setUploadModal(false)
        
        // Show success message with details
        const successMessage = `✅ Successfully uploaded ${result.data?.length || csvData.length} calendar items!\n\nThe dashboard has been updated with your new content.`
        alert(successMessage)
        
        // Optionally refresh the page data to ensure consistency
        setTimeout(() => {
          fetchCalendarData()
        }, 1000)
      } else {
        const error = await response.json()
        console.error('Upload error:', error)
        alert(`❌ Upload failed: ${error.error}\n\nPlease check your CSV format and try again.`)
      }
    } catch (err) {
      console.error('CSV Upload Error:', err)
      alert('Failed to process CSV file. Please check the format.')
    } finally {
      setUploading(false)
    }
  }

  // CSV Download Function
  const handleCSVDownload = () => {
    if (calendarData.length === 0) {
      alert('No data to download')
      return
    }

    const headers = [
      'Date', 'Day', 'Platform', 'Type', 'Team Status', 'Client Status', 
      'Hook', 'Copy', 'KPI', 'Image Prompt 1', 'Image Prompt 2', 'Comments'
    ]
    
    const csvContent = [
      headers.join(','),
      ...calendarData.map(item => [
        `"${item.date}"`,
        `"${item.day}"`,
        `"${Array.isArray(item.platform) ? item.platform.join('|') : item.platform}"`,
        `"${item.type}"`,
        `"${item.team_status}"`,
        `"${item.client_status}"`,
        `"${item.hook}"`,
        `"${item.copy.replace(/"/g, '""')}"`,
        `"${item.kpi || ''}"`,
        `"${item.image_prompt_1 || ''}"`,
        `"${item.image_prompt_2 || ''}"`,
        `"${Array.isArray(item.comments) ? item.comments.join(' | ') : ''}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `content-calendar-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    const isDatabaseSetupError = error.includes('Database tables not set up')
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <div className="text-6xl mb-4">🔧</div>
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            {isDatabaseSetupError ? 'Database Setup Required' : 'Error'}
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          
          {isDatabaseSetupError && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
              <h3 className="font-bold text-blue-800 mb-3">📋 Setup Instructions:</h3>
              <ol className="list-decimal list-inside space-y-2 text-blue-700">
                <li>Go to your <strong>Supabase project dashboard</strong></li>
                <li>Navigate to the <strong>SQL Editor</strong></li>
                <li>Copy and paste the contents of <code className="bg-blue-100 px-2 py-1 rounded">database/schema.sql</code></li>
                <li>Click <strong>"Run"</strong> to create all tables</li>
                <li>Run <code className="bg-blue-100 px-2 py-1 rounded">npx tsx scripts/seed-clients.ts</code> to add sample clients</li>
                <li>Assign your user to a client in the database</li>
              </ol>
            </div>
          )}
          
          <div className="flex gap-4 justify-center">
            <button 
              onClick={fetchCalendarData}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
            {isDatabaseSetupError && (
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Open Supabase Dashboard
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <ClientBranding user={user}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        {/* Header */}
        <ClientHeader 
          user={user}
          userEmail={user?.email || ''}
          onLogout={handleLogout}
        />

      <div className="max-w-7xl text-background mx-auto px-4 py-8">
        {/* Workflow Guide */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-lg p-6 mb-8 border-l-4 border-blue-500">
          <h3 className="text-xl font-bold mb-4 text-gray-800">🔄 How the Workflow Works</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Step 1 */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-t-4 border-orange-400">
              <div className="text-center mb-3">
                <div className="text-2xl font-bold text-orange-600">Step 1</div>
                <div className="text-sm font-semibold text-gray-700">👥 Our Team</div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span>Not Started</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-0 h-0 border-l-2 border-gray-400 border-t-2 border-transparent border-b-2 ml-1"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                  <span>In Progress</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-0 h-0 border-l-2 border-gray-400 border-t-2 border-transparent border-b-2 ml-1"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                  <span>Ready for Review</span>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-t-4 border-purple-400">
              <div className="text-center mb-3">
                <div className="text-2xl font-bold text-purple-600">Step 2</div>
                <div className="text-sm font-semibold text-gray-700">👤 Client</div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                  <span>Under Review</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-0 h-0 border-l-2 border-gray-400 border-t-2 border-transparent border-b-2 ml-1"></div>
                </div>
                <div className="flex items-center space-x-2 text-green-600">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span>✅ Approved</span>
                </div>
                <div className="text-center text-gray-500 text-xs">OR</div>
                <div className="flex items-center space-x-2 text-red-600">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <span>❌ Needs Changes</span>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-t-4 border-green-400">
              <div className="text-center mb-3">
                <div className="text-2xl font-bold text-green-600">Step 3</div>
                <div className="text-sm font-semibold text-gray-700">✅ If Approved</div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span>👥 Ready to Post</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-0 h-0 border-l-2 border-gray-400 border-t-2 border-transparent border-b-2 ml-1"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  <span>📅 Schedule & Publish</span>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-t-4 border-red-400">
              <div className="text-center mb-3">
                <div className="text-2xl font-bold text-red-600">Step 4</div>
                <div className="text-sm font-semibold text-gray-700">🔄 If Changes</div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                  <span>👥 In Progress (revise)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-0 h-0 border-l-2 border-gray-400 border-t-2 border-transparent border-b-2 ml-1"></div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                  <span>Ready for Review</span>
                </div>
                <div className="text-center text-gray-500 text-xs mt-2">↩️ Loop back to Step 2</div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Dashboard */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h3 className="text-xl font-bold mb-6" style={{ color: user?.brand_color || '#3B82F6' }}>📊 Workflow Status Dashboard</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 rounded-lg p-4 border-t-4 border-blue-500">
              <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-4">👥 Our Team Status</h4>
              <div className="space-y-2">
                {Object.entries(teamCounts).map(([status, count]) => (
                  <div key={status} className="flex text-background justify-between items-center bg-white p-3 rounded-lg">
                    <span className="font-medium text-sm capitalize">{status.replace('-', ' ')}</span>
                    <span className="text-xl font-bold text-gray-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4 border-t-4 border-purple-500">
              <h4 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-4">👤 Client Status</h4>
              <div className="space-y-2">
                {Object.entries(clientCounts).map(([status, count]) => (
                  <div key={status} className="flex text-background justify-between items-center bg-white p-3 rounded-lg">
                    <span className="font-medium text-sm capitalize">{status.replace('-', ' ')}</span>
                    <span className="text-xl font-bold text-gray-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-4" style={{ color: user?.brand_color || '#3B82F6' }}>📋 Quick Actions</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* OneDrive External Links */}
            <a
              href="https://onedrive.live.com/edit.aspx?resid=YOUR_ONEDRIVE_ID&cid=YOUR_CID&app=Excel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>📥 Full Calendar CSV</span>
            </a>
            
            <a
              href="https://onedrive.live.com/edit.aspx?resid=YOUR_TEAM_ONEDRIVE_ID&cid=YOUR_CID&app=Excel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>👥 Our Team View</span>
            </a>
            
            <a
              href="https://onedrive.live.com/edit.aspx?resid=YOUR_CLIENT_ONEDRIVE_ID&cid=YOUR_CID&app=Excel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>👤 Client Review Package</span>
            </a>
            
            <a
              href="https://onedrive.live.com/edit.aspx?resid=YOUR_STATUS_ONEDRIVE_ID&cid=YOUR_CID&app=Excel"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>📊 Status Report</span>
            </a>
          </div>
          
          {/* CSV Upload/Download Actions */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-lg font-semibold mb-4 text-gray-800">📂 File Management</h4>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setUploadModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Upload className="h-4 w-4" />
                <span>Upload CSV</span>
              </button>
              
              <button
                onClick={handleCSVDownload}
                disabled={calendarData.length === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                <span>Download CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full table-fixed min-w-[1400px]">
              <thead className="text-white sticky top-0 z-10" style={{ backgroundColor: user?.brand_color || '#3B82F6' }}>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold w-24">Date</th>
                  <th className="px-4 py-3 text-left font-semibold w-32">Platform</th>
                  <th className="px-4 py-3 text-left font-semibold w-24">Type</th>
                  <th className="px-4 py-3 text-left font-semibold w-40">👥 Our Team</th>
                  <th className="px-4 py-3 text-left font-semibold w-40">👤 Client</th>
                  <th className="px-4 py-3 text-left font-semibold w-48">Hook</th>
                  <th className="px-4 py-3 text-left font-semibold w-64">Caption</th>
                  <th className="px-4 py-3 text-left font-semibold w-64">Image Prompts</th>
                  <th className="px-4 py-3 text-left font-semibold w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {calendarData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="text-6xl opacity-50">📅</div>
                        <div className="text-xl font-semibold text-gray-800">No Content Calendar Yet</div>
                        <div className="text-gray-800 max-w-md">
                          {user?.company_name ? (
                            `Welcome to ${user.company_name}! Your content calendar will appear here once content is added.`
                          ) : (
                            'Your content calendar will appear here once content is added.'
                          )}
                        </div>
                        <button
                          onClick={() => window.location.reload()}
                          className="mt-4 px-6 py-2 text-white rounded-lg transition-colors hover:opacity-90"
                          style={{ 
                            backgroundColor: user?.brand_color || '#3B82F6'
                          }}
                        >
                          Refresh
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  calendarData.map((item, index) => (
                    <CalendarRow
                      key={item.id}
                      item={item}
                      index={index}
                      updating={updating === item.id}
                      onUpdate={updateCalendarItem}
                      onCopyCaption={handleCopyCaption}
                      onOpenComment={openCommentModal}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CSV Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0  bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">📤 Upload CSV File</h3>
              <button
                onClick={() => setUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={uploading}
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Upload a CSV file with your content calendar data. The parser is flexible and supports various column names:
              </p>
              <ul className="text-xs text-gray-500 list-disc list-inside space-y-1">
                <li><strong>Required:</strong> Date, Day, Hook</li>
                <li><strong>Platform:</strong> Use | to separate multiple platforms (IG|FB|Stories)</li>
                <li><strong>Content:</strong> Copy, Caption, Content, or Text (all work the same)</li>
                <li><strong>Prompts:</strong> "Image Prompt 1/2", "Prompt 1/2", or "Prompt1/2"</li>
                <li><strong>Status:</strong> Automatically validates and corrects invalid values</li>
                <li><strong>Comments:</strong> Comments, Notes, or Note</li>
              </ul>
              <div className="mt-3">
                <a
                  href="/sample-calendar.csv"
                  download="sample-calendar.csv"
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  📥 Download sample CSV template
                </a>
              </div>
            </div>
            
            <div className="mb-6">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleCSVUpload(file)
                  }
                }}
                disabled={uploading}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            {uploading && (
              <div className="flex flex-col items-center justify-center space-y-3 text-blue-600 bg-blue-50 p-4 rounded-lg">
                <Loader2 className="h-6 w-6 animate-spin" />
                <div className="text-center">
                  <div className="font-semibold">Processing CSV file...</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Parsing content, validating data, and uploading to database
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setUploadModal(false)}
                disabled={uploading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {commentModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">💬 Comments</h3>
              <button
                onClick={() => setCommentModal({ isOpen: false, itemId: '', comments: [], newComment: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            {/* Existing Comments */}
            {commentModal.comments.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Previous Comments:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {commentModal.comments.map((comment, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                      <p className="text-sm text-background">{comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Add New Comment */}
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Add New Comment:</h4>
              <textarea
                value={commentModal.newComment}
                onChange={(e) => setCommentModal(prev => ({ ...prev, newComment: e.target.value }))}
                className="w-full h-32 p-3 border border-gray-300 text-background rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your comment or feedback..."
              />
            </div>
            
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setCommentModal({ isOpen: false, itemId: '', comments: [], newComment: '' })}
                className="px-4 py-2 text-background bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={addComment}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90"
                style={{ backgroundColor: user?.brand_color || '#3B82F6' }}
                disabled={!commentModal.newComment.trim()}
              >
                Add Comment
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ClientBranding>
  )
}

// Calendar Row Component
function CalendarRow({ 
  item, 
  index, 
  updating, 
  onUpdate, 
  onCopyCaption, 
  onOpenComment 
}: {
  item: ContentCalendarItem
  index: number
  updating: boolean
  onUpdate: (id: string, updates: Partial<ContentCalendarItem>) => void
  onCopyCaption: (copy: string) => void
  onOpenComment: (itemId: string, comments: string[]) => void
}) {
  const getPlatformTags = (platforms: string[]) => {
    const colors = {
      IG: 'bg-pink-500',
      FB: 'bg-blue-600',
      Google: 'bg-blue-500',
      Stories: 'bg-purple-600'
    }
    
    return platforms.map(platform => (
      <span
        key={platform}
        className={`inline-block px-2 py-1 text-xs font-semibold text-white rounded mr-1 ${colors[platform as keyof typeof colors] || 'bg-gray-500'}`}
      >
        {platform}
      </span>
    ))
  }

  const getTypeStyle = (type: string) => {
    const styles = {
      reel: 'bg-pink-100 text-pink-800',
      carousel: 'bg-blue-100 text-blue-800',
      photo: 'bg-green-100 text-green-800',
      testimonial: 'bg-orange-100 text-orange-800',
      education: 'bg-purple-100 text-purple-800',
      offer: 'bg-red-100 text-red-800',
      promo: 'bg-yellow-100 text-yellow-800'
    }
    return styles[type as keyof typeof styles] || 'bg-gray-100 text-gray-800'
  }

  const getStatusStyle = (status: string, type: 'team' | 'client') => {
    if (type === 'team') {
      const styles = {
        'not-started': 'bg-gray-100 border-gray-300 text-gray-600',
        'in-progress': 'bg-orange-100 border-orange-300 text-orange-700',
        'ready-review': 'bg-blue-100 border-blue-300 text-blue-700',
        'ready-post': 'bg-green-100 border-green-300 text-green-700'
      }
      return styles[status as keyof typeof styles] || 'bg-gray-100 border-gray-300 text-gray-600'
    } else {
      const styles = {
        'not-submitted': 'bg-gray-100 border-gray-300 text-gray-600',
        'under-review': 'bg-purple-100 border-purple-300 text-purple-700',
        'approved': 'bg-green-100 border-green-300 text-green-700',
        'needs-changes': 'bg-red-100 border-red-300 text-red-700'
      }
      return styles[status as keyof typeof styles] || 'bg-gray-100 border-gray-300 text-gray-600'
    }
  }

  return (
    <tr className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-green-50 transition-colors border-b border-gray-200`}>
      <td className="px-4 py-4">
        <div className="font-bold text-green-700">{item.date}</div>
        <div className="text-xs text-gray-500">{item.day}</div>
        {item.is_new && <span className="inline-block bg-red-500 text-white text-xs px-2 py-1 rounded mt-1">NEW</span>}
      </td>
      
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-1">
          {getPlatformTags(item.platform)}
        </div>
      </td>
      
      <td className="px-4 py-4">
        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full uppercase ${getTypeStyle(item.type)}`}>
          {item.type}
        </span>
      </td>
      
      <td className="px-4 py-4">
        <select
          value={item.team_status}
          onChange={(e) => onUpdate(item.id, { team_status: e.target.value as any })}
          disabled={updating}
          className={`w-full px-3 py-2 text-sm font-semibold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${getStatusStyle(item.team_status, 'team')}`}
        >
          <option value="not-started">Not Started</option>
          <option value="in-progress">In Progress</option>
          <option value="ready-review">Ready for Review</option>
          <option value="ready-post">Ready to Post</option>
        </select>
      </td>
      
      <td className="px-4 py-4">
        <select
          value={item.client_status}
          onChange={(e) => onUpdate(item.id, { client_status: e.target.value as any })}
          disabled={updating}
          className={`w-full px-3 py-2 text-sm font-semibold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${getStatusStyle(item.client_status, 'client')}`}
        >
          <option value="not-submitted">Not Submitted</option>
          <option value="under-review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="needs-changes">Needs Changes</option>
        </select>
      </td>
      
      <td className="px-4 py-4">
        <div className="font-semibold text-background text-sm">{item.hook}</div>
      </td>
      
      <td className="px-4 py-4 max-w-md">
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm text-background font-semibold">Caption:</span>
          <button
            onClick={() => onCopyCaption(item.copy)}
            className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
          >
            <Copy className="h-3 w-3" />
            <span>Copy</span>
          </button>
        </div>
        <div className="max-h-32 overflow-y-auto text-background p-3 bg-gray-50 rounded text-sm border">
          {item.copy.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </td>
      
      <td className="px-4 py-4 max-w-md">
        <div className="space-y-3">
          <div>
            <div className="text-xs text-background font-semibold mb-1">Prompt 1:</div>
            <div className="max-h-20 overflow-y-auto text-background p-2 bg-blue-50 rounded text-xs border">
              {item.image_prompt_1 || 'No prompt provided'}
            </div>
          </div>
          <div>
            <div className="text-xs text-background font-semibold mb-1">Prompt 2:</div>
            <div className="max-h-20 overflow-y-auto text-background p-2 bg-purple-50 rounded text-xs border">
              {item.image_prompt_2 || 'No prompt provided'}
            </div>
          </div>
        </div>
      </td>
      
      <td className="px-4 py-4">
        <button
          onClick={() => onOpenComment(item.id, item.comments || [])}
          className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 w-full justify-center"
        >
          <MessageCircle className="h-3 w-3" />
          <span>
            {item.comments && item.comments.length > 0 
              ? `Comments (${item.comments.length})` 
              : 'Add Comment'
            }
          </span>
        </button>
        {updating && (
          <div className="flex items-center justify-center mt-2">
            <Loader2 className="h-4 w-4 animate-spin text-green-600" />
          </div>
        )}
      </td>
    </tr>
  )
}

// Dashboard Skeleton Component
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <header className="bg-gradient-to-r from-green-700 to-green-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Skeleton className="h-8 w-80 mb-2" />
          <Skeleton className="h-4 w-60" />
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <Skeleton className="h-6 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
