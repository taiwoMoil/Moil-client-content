'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ContentCalendarItem, User } from '@/lib/types/database'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientBranding, ClientHeader } from '@/components/client-branding'
import { Metaballs } from '@paper-design/shaders-react'
import { Download, Copy, MessageCircle, Loader2, Upload, ExternalLink, Calendar, Users, BarChart3, Settings, Link, AlertCircle, CheckCircle, Clock, ArrowRight, Workflow, FileText, Image, Hash, UserIcon } from 'lucide-react'
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
  const [updateModal, setUpdateModal] = useState<{
    isOpen: boolean;
    message: string;
    type: 'team' | 'client' | 'comment' | null;
  }>({
    isOpen: false,
    message: '',
    type: null
  })
  const [uploading, setUploading] = useState(false)
  const [uploadModal, setUploadModal] = useState(false)
  const [linkModal, setLinkModal] = useState<{
    isOpen: boolean;
    type: 'team_review' | 'client_dropoff' | 'ready_schedule' | 'status_report' | null;
    currentLink: string;
  }>({
    isOpen: false,
    type: null,
    currentLink: ''
  })

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
        // Sort the data by date to ensure proper chronological order
        const sortedData = (result.data || []).sort((a: ContentCalendarItem, b: ContentCalendarItem) => {
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        })
        setCalendarData(sortedData)
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

  const updateCalendarItem = async (id: string, updates: Partial<ContentCalendarItem>, updateType?: 'team' | 'client') => {
    setUpdating(id)
    
    // Show update modal based on type
    if (updateType) {
      const messages = {
        team: 'Updating team status...',
        client: 'Updating client status...'
      }
      setUpdateModal({
        isOpen: true,
        message: messages[updateType],
        type: updateType
      })
    }

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
        
        // Show success message briefly
        if (updateType) {
          const successMessages = {
            team: 'Team status updated successfully!',
            client: 'Client status updated successfully!'
          }
          setUpdateModal({
            isOpen: true,
            message: successMessages[updateType],
            type: updateType
          })
          
          // Auto-close after 1.5 seconds
          setTimeout(() => {
            setUpdateModal({ isOpen: false, message: '', type: null })
          }, 1500)
        }
      } else {
        const error = await response.json()
        alert('Failed to update: ' + error.error)
        setUpdateModal({ isOpen: false, message: '', type: null })
      }
    } catch (err) {
      alert('Failed to update item')
      setUpdateModal({ isOpen: false, message: '', type: null })
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
      // Show comment update modal
      setUpdateModal({
        isOpen: true,
        message: 'Adding comment...',
        type: 'comment'
      })

      const updatedComments = [...commentModal.comments, commentModal.newComment.trim()]
      
      try {
        await updateCalendarItem(commentModal.itemId, { comments: updatedComments })
        
        // Show success message
        setUpdateModal({
          isOpen: true,
          message: 'Comment added successfully!',
          type: 'comment'
        })
        
        setCommentModal({
          isOpen: false,
          itemId: '',
          comments: [],
          newComment: ''
        })
        
        // Auto-close after 1.5 seconds
        setTimeout(() => {
          setUpdateModal({ isOpen: false, message: '', type: null })
        }, 1500)
      } catch (err) {
        setUpdateModal({ isOpen: false, message: '', type: null })
      }
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

        // Sort the data by date before setting it
        const sortedData = (result.data || []).sort((a: ContentCalendarItem, b: ContentCalendarItem) => {
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        })

        // Update the calendar data with the new items
        setCalendarData(sortedData)
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

  // OneDrive Link Management
  const handleLinkClick = (type: 'team_review' | 'client_dropoff' | 'ready_schedule' | 'status_report') => {
    const linkMap = {
      team_review: user?.onedrive_team_review_link,
      client_dropoff: user?.onedrive_client_dropoff_link,
      ready_schedule: user?.onedrive_ready_schedule_link,
      status_report: user?.onedrive_status_report_link
    }

    const currentLink = linkMap[type]

    if (currentLink) {
      window.open(currentLink, '_blank', 'noopener,noreferrer')
    } else {
      setLinkModal({
        isOpen: true,
        type,
        currentLink: ''
      })
    }
  }

  const saveLinkUpdate = async () => {
    if (!linkModal.type || !user) return

    const fieldMap = {
      team_review: 'onedrive_team_review_link',
      client_dropoff: 'onedrive_client_dropoff_link',
      ready_schedule: 'onedrive_ready_schedule_link',
      status_report: 'onedrive_status_report_link'
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ [fieldMap[linkModal.type]]: linkModal.currentLink })
        .eq('id', user.id)

      if (error) {
        alert('Failed to save link: ' + error.message)
        return
      }

      // Update local user state
      setUser(prev => {
        if (!prev || !linkModal.type) return prev
        return {
          ...prev,
          [fieldMap[linkModal.type]]: linkModal.currentLink
        }
      })

      setLinkModal({ isOpen: false, type: null, currentLink: '' })

      if (linkModal.currentLink) {
        window.open(linkModal.currentLink, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      alert('Failed to save link')
    }
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
      <div className="min-h-screen bg-background relative">
        <Metaballs
          colors={["#5843BE", "#FF6633", "#ffc105", "#ffc800", "#f585ff"]}
          colorBack="#000000"
          count={10}
          size={0.83}
          speed={1}
          className="absolute inset-0 opacity-30" style={{ filter: 'invert(1)' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-white/90 to-orange-50/20 pointer-events-none" />
        {/* Header */}
        <ClientHeader
          user={user}
          userEmail={user?.email || ''}
          onLogout={handleLogout}
        />

        <div className="max-w-full text-background mx-auto px-4 py-8">
          {/* Workflow Guide */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg p-8 mb-8 border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-600)] rounded-lg">
                <Workflow className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--primary)]">Content Workflow Process</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="bg-white rounded-xl p-6 card-shadow border border-gray-100 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">Step 1</div>
                    <div className="text-sm text-gray-600">Our Team</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">Not Started</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 mx-auto" />
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-orange-50">
                    <Loader2 className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-900">In Progress</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 mx-auto" />
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-900">Ready for Review</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-white rounded-xl p-6 card-shadow border border-gray-100 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                    <UserIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">Step 2</div>
                    <div className="text-sm text-gray-600">Client Review</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-purple-50">
                    <Clock className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-gray-900">Under Review</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 mx-auto" />
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-gray-900">Approved</span>
                    </div>
                    <div className="text-center text-xs text-gray-500">OR</div>
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-red-50">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-gray-900">Needs Changes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-white rounded-xl p-6 card-shadow border border-gray-100 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">Step 3</div>
                    <div className="text-sm text-gray-600">If Approved</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-green-50">
                    <Users className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-900">Ready to Post</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 mx-auto" />
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-green-100">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-900">Schedule & Publish</span>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-white rounded-xl p-6 card-shadow border border-gray-100 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-lg">
                    <ArrowRight className="h-5 w-5 text-white transform rotate-180" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">Step 4</div>
                    <div className="text-sm text-gray-600">If Changes</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-orange-50">
                    <Loader2 className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-gray-900">In Progress (revise)</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 mx-auto" />
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-900">Ready for Review</span>
                  </div>
                  <div className="text-center text-xs text-gray-500 mt-3 p-2 bg-gray-50 rounded-lg">
                    Loop back to Step 2
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Dashboard */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg p-8 mb-8 border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-600)] rounded-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--primary)]">Workflow Status Dashboard</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Team Status */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Our Team Status</h4>
                      <p className="text-sm text-gray-600">Internal workflow progress</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {Object.entries(teamCounts).map(([status, count]) => {
                    const statusConfig = {
                      'not-started': { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Not Started' },
                      'in-progress': { icon: Loader2, color: 'text-orange-600', bg: 'bg-orange-50', label: 'In Progress' },
                      'ready-review': { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Ready for Review' },
                      'ready-post': { icon: Calendar, color: 'text-green-600', bg: 'bg-green-50', label: 'Ready to Post' }
                    }[status] || { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', label: status }

                    const IconComponent = statusConfig.icon

                    return (
                      <div key={status} className={`flex items-center justify-between p-3 rounded-lg ${statusConfig.bg} border border-gray-100`}>
                        <div className="flex items-center gap-3">
                          <IconComponent className={`h-4 w-4 ${statusConfig.color}`} />
                          <span className="font-medium text-sm text-gray-900">{statusConfig.label}</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Client Status */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <UserIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Client Status</h4>
                      <p className="text-sm text-gray-600">Client review progress</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {Object.entries(clientCounts).map(([status, count]) => {
                    const statusConfig = {
                      'not-submitted': { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Not Submitted' },
                      'under-review': { icon: Loader2, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Under Review' },
                      'approved': { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Approved' },
                      'needs-changes': { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Needs Changes' }
                    }[status] || { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', label: status }

                    const IconComponent = statusConfig.icon

                    return (
                      <div key={status} className={`flex items-center justify-between p-3 rounded-lg ${statusConfig.bg} border border-gray-100`}>
                        <div className="flex items-center gap-3">
                          <IconComponent className={`h-4 w-4 ${statusConfig.color}`} />
                          <span className="font-medium text-sm text-gray-900">{statusConfig.label}</span>
                        </div>
                        <span className="text-xl font-bold text-gray-900">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg p-8 mb-8 border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-[var(--secondary)] to-[var(--secondary-600)] rounded-lg">
                <Link className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[var(--primary)]">OneDrive Integration</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Team Review Link */}
              <button
                onClick={() => handleLinkClick('team_review')}
                className="group flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200"
              >
                <div className="p-2 bg-blue-100 group-hover:bg-blue-200 rounded-lg transition-colors">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900 text-sm">Ready for Review</div>
                  <div className="text-xs text-gray-500">Team review files</div>
                  {user?.onedrive_team_review_link ? (
                    <div className="text-xs text-green-600 mt-1">✓ Link configured</div>
                  ) : (
                    <div className="text-xs text-orange-600 mt-1">⚠ Setup required</div>
                  )}
                </div>
              </button>

              {/* Client Dropoff Link */}
              <button
                onClick={() => handleLinkClick('client_dropoff')}
                className="group flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all duration-200"
              >
                <div className="p-2 bg-purple-100 group-hover:bg-purple-200 rounded-lg transition-colors">
                  <UserIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900 text-sm">Client Dropoff</div>
                  <div className="text-xs text-gray-500">Client delivery files</div>
                  {user?.onedrive_client_dropoff_link ? (
                    <div className="text-xs text-green-600 mt-1">✓ Link configured</div>
                  ) : (
                    <div className="text-xs text-orange-600 mt-1">⚠ Setup required</div>
                  )}
                </div>
              </button>

              {/* Ready to Schedule Link */}
              <button
                onClick={() => handleLinkClick('ready_schedule')}
                className="group flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all duration-200"
              >
                <div className="p-2 bg-green-100 group-hover:bg-green-200 rounded-lg transition-colors">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900 text-sm">Ready to Schedule</div>
                  <div className="text-xs text-gray-500">Scheduling files</div>
                  {user?.onedrive_ready_schedule_link ? (
                    <div className="text-xs text-green-600 mt-1">✓ Link configured</div>
                  ) : (
                    <div className="text-xs text-orange-600 mt-1">⚠ Setup required</div>
                  )}
                </div>
              </button>

              {/* Status Report Link */}
              <button
                onClick={() => handleLinkClick('status_report')}
                className="group flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all duration-200"
              >
                <div className="p-2 bg-emerald-100 group-hover:bg-emerald-200 rounded-lg transition-colors">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900 text-sm">Status Report</div>
                  <div className="text-xs text-gray-500">Analytics & reports</div>
                  {user?.onedrive_status_report_link ? (
                    <div className="text-xs text-green-600 mt-1">✓ Link configured</div>
                  ) : (
                    <div className="text-xs text-orange-600 mt-1">⚠ Setup required</div>
                  )}
                </div>
              </button>
            </div>

            {/* CSV Upload/Download Actions */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-1.5 bg-gray-100 rounded-lg">
                  <FileText className="h-4 w-4 text-gray-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900">File Management</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setUploadModal(true)}
                  className="flex items-center gap-3 p-4 bg-gradient-to-r from-[var(--secondary)] to-[var(--secondary-600)] text-white rounded-xl hover:from-[var(--secondary-600)] hover:to-[var(--secondary-700)] transition-all duration-200 shadow-sm"
                >
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">Upload CSV</div>
                    <div className="text-sm opacity-90">Import content calendar</div>
                  </div>
                </button>
                <button
                  onClick={handleCSVDownload}
                  disabled={calendarData.length === 0}
                  className={`flex items-center gap-3 p-4 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-600)] text-white rounded-xl hover:from-[var(--primary-600)] hover:to-[var(--primary-700)] transition-all duration-200 shadow-sm ${calendarData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Download className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">Download CSV</div>
                    <div className="text-sm opacity-90">Export current data</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Table */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></div>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-600)] rounded-lg">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-[var(--primary)]">Content Calendar</h3>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
              <table className="w-full min-w-[1600px]">
                <thead className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-600)] text-white sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold w-32">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Date</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold w-40">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        <span>Platform</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold w-32">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Type</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold w-44">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>Our Team</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold w-44">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        <span>Client</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold w-56">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        <span>Hook</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold w-72">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Caption</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold w-72">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        <span>Image Prompts</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left font-semibold w-36">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <span>Actions</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calendarData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className="p-4 bg-gray-100 rounded-2xl">
                            <Calendar className="h-12 w-12 text-gray-400 mx-auto" />
                          </div>
                          <div className="text-xl font-semibold text-gray-800">No Content Calendar Yet</div>
                          <div className="text-gray-600 max-w-md text-center">
                            {user?.company_name ? (
                              `Welcome to ${user.company_name}! Your content calendar will appear here once content is added.`
                            ) : (
                              'Your content calendar will appear here once content is added.'
                            )}
                          </div>
                          <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-600)] text-white rounded-xl hover:from-[var(--primary-600)] hover:to-[var(--primary-700)] transition-all duration-200 font-semibold"
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
      </div>

      {/* CSV Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="h-5 w-5 text-[var(--secondary)]" />
                Upload CSV File
              </h3>
              <button
                onClick={() => setUploadModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                disabled={uploading}
              >
                <ArrowRight className="h-5 w-5 transform rotate-45" />
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[var(--primary)]" />
                Comments
              </h3>
              <button
                onClick={() => setCommentModal({ isOpen: false, itemId: '', comments: [], newComment: '' })}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowRight className="h-5 w-5 transform rotate-45" />
              </button>
            </div>

            {/* Existing Comments */}
            {commentModal.comments.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Previous Comments:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {commentModal.comments.map((comment, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                      <p className="text-sm text-gray-900">{comment}</p>
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
                className="w-full h-32 p-3 border border-gray-300 text-gray-900 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your comment or feedback..."
              />
            </div>

            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setCommentModal({ isOpen: false, itemId: '', comments: [], newComment: '' })}
                className="px-4 py-2 text-gray-900 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={addComment}
                className={`px-4 py-2 text-white rounded-lg hover:opacity-90 ${`text-[${user?.brand_color || '#5843BE'}]`}`}
                disabled={!commentModal.newComment.trim()}
              >
                Add Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OneDrive Link Management Modal */}
      {linkModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Link className="h-5 w-5 text-[var(--primary)]" />
                Configure OneDrive Link
              </h3>
              <button
                onClick={() => setLinkModal({ isOpen: false, type: null, currentLink: '' })}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowRight className="h-5 w-5 transform rotate-45" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">
                Enter the OneDrive link for{' '}
                <span className="font-semibold text-gray-900">
                  {linkModal.type === 'team_review' && 'Team Review Files'}
                  {linkModal.type === 'client_dropoff' && 'Client Dropoff Files'}
                  {linkModal.type === 'ready_schedule' && 'Ready to Schedule Files'}
                  {linkModal.type === 'status_report' && 'Status Report Files'}
                </span>
              </p>
              <input
                type="url"
                value={linkModal.currentLink}
                onChange={(e) => setLinkModal(prev => ({ ...prev, currentLink: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] text-gray-900 placeholder-gray-500"
                placeholder="https://onedrive.live.com/..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setLinkModal({ isOpen: false, type: null, currentLink: '' })}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveLinkUpdate}
                disabled={!linkModal.currentLink.trim()}
                className="px-4 py-2 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-600)] text-white rounded-xl hover:from-[var(--primary-600)] hover:to-[var(--primary-700)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {updateModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-gray-200 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="p-3 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-600)] rounded-2xl">
                {updateModal.message.includes('successfully') ? (
                  <CheckCircle className="h-8 w-8 text-white" />
                ) : (
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {updateModal.message.includes('successfully') ? 'Success!' : 'Updating...'}
                </h3>
                <p className="text-sm text-gray-600">
                  {updateModal.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
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
  onUpdate: (id: string, updates: Partial<ContentCalendarItem>, updateType?: 'team' | 'client') => void
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
          onChange={(e) => onUpdate(item.id, { team_status: e.target.value as any }, 'team')}
          disabled={updating}
          className={`w-full px-3 py-2 text-sm font-semibold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${getStatusStyle(item.team_status, 'team')}`}
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
          onChange={(e) => onUpdate(item.id, { client_status: e.target.value as any }, 'client')}
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
        <div className="font-semibold text-gray-900 text-sm">{item.hook}</div>
      </td>

      <td className="px-4 py-4 max-w-md">
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm text-gray-900 font-semibold">Caption:</span>
          <button
            onClick={() => onCopyCaption(item.copy)}
            className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
          >
            <Copy className="h-3 w-3" />
            <span>Copy</span>
          </button>
        </div>
        <div className="max-h-32 overflow-y-auto text-gray-900 p-3 bg-gray-50 rounded text-sm border">
          {item.copy.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </td>

      <td className="px-4 py-4 max-w-md">
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-900 font-semibold mb-1">Prompt 1:</div>
            <div className="max-h-20 overflow-y-auto text-gray-900 p-2 bg-blue-50 rounded text-xs border">
              {item.image_prompt_1 || 'No prompt provided'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-900 font-semibold mb-1">Prompt 2:</div>
            <div className="max-h-20 overflow-y-auto text-gray-900 p-2 bg-purple-50 rounded text-xs border">
              {item.image_prompt_2 || 'No prompt provided'}
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-4">
        <button
          onClick={() => onOpenComment(item.id, item.comments || [])}
          className={`flex items-center space-x-1 px-3 py-2 bg-[#5843BE] text-white text-xs rounded hover:bg-blue-700 w-full justify-center`}
        >
          <MessageCircle className="h-3 w-3" />
          <span>
            {item.comments && item.comments.length > 0
              ? `Comments (${item.comments.length})`
              : 'Add Comment'
            }
          </span>
        </button>
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
