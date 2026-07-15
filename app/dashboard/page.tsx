'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ContentCalendarItem, User } from '@/lib/types/database'
import { CommentEntry, createComment, countUnreadForItems } from '@/lib/comments'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientBranding, ClientHeader } from '@/components/client-branding'
import { Metaballs } from '@paper-design/shaders-react'
import { Download, Copy, MessageCircle, Loader2, Upload, ExternalLink, Calendar, Users, BarChart3, Settings, Link, AlertCircle, CheckCircle, Clock, ArrowRight, Workflow, FileText, Image, Hash, UserIcon, Edit3, Save, X, Plus, Trash2, Sparkles, RefreshCw, ChevronLeft, ChevronRight, LayoutGrid, Table as TableIcon } from 'lucide-react'
import { copyToClipboard } from '@/lib/utils'

export default function DashboardPage() {
  const [calendarData, setCalendarData] = useState<ContentCalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  // Per-viewer read markers: itemId -> last_read_at ISO string. Powers the
  // unread-comment badge on the calendar.
  const [reads, setReads] = useState<Record<string, string>>({})
  const [commentModal, setCommentModal] = useState<{
    isOpen: boolean;
    itemId: string;
    comments: CommentEntry[];
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
  const [insertModal, setInsertModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    itemId: string;
    itemDate: string;
  }>({
    isOpen: false,
    itemId: '',
    itemDate: ''
  })
  const [linkModal, setLinkModal] = useState<{
    isOpen: boolean;
    type: 'team_review' | 'client_dropoff' | 'ready_schedule' | 'status_report' | null;
    currentLink: string;
  }>({
    isOpen: false,
    type: null,
    currentLink: ''
  })
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    prompt: string;
    loading: boolean;
  }>({
    isOpen: false,
    imageUrl: '',
    prompt: '',
    loading: false
  })
  const [regenerateModal, setRegenerateModal] = useState<{
    isOpen: boolean;
    itemId: string;
    contentType: 'hook' | 'caption' | 'image_prompt_1' | 'image_prompt_2' | null;
    currentContent: string;
    corrections: string[];
    loading: boolean;
    context: ContentCalendarItem | null;
  }>({
    isOpen: false,
    itemId: '',
    contentType: null,
    currentContent: '',
    corrections: [],
    loading: false,
    context: null
  })

  // View mode: 'calendar' grid (default) or original 'table'
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar')
  // Anchor date for the visible month in calendar view (first of month)
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  // Selected day for the right-side drawer (null = closed)
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)

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
      // Check if admin is impersonating a client
      const impersonateClientId = sessionStorage.getItem('admin_impersonate_client')
      
      if (impersonateClientId) {
        // Verify current user is admin and fetch impersonated client data
        const { data: adminProfile } = await supabase
          .from('users')
          .select('role')
          .eq('id', authUser.id)
          .single()

        if (adminProfile?.role === 'admin') {
          // Fetch the client being impersonated
          const { data: clientProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', impersonateClientId)
            .single()

          if (clientProfile) {
            setUser(clientProfile)
            return
          }
        }
        // Clear invalid impersonation
        sessionStorage.removeItem('admin_impersonate_client')
      }

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

  // Helper function to get API URL with client_id if admin is impersonating
  const getApiUrl = (endpoint: string) => {
    const impersonateClientId = sessionStorage.getItem('admin_impersonate_client')
    if (impersonateClientId) {
      const separator = endpoint.includes('?') ? '&' : '?'
      return `${endpoint}${separator}client_id=${impersonateClientId}`
    }
    return endpoint
  }

  const fetchCalendarData = async () => {
    try {
      const url = getApiUrl('/api/calendar')
      const response = await fetch(url)
      const result = await response.json()

      if (response.ok) {
        // Sort the data by date to ensure proper chronological order
        const sortedData = (result.data || []).sort((a: ContentCalendarItem, b: ContentCalendarItem) => {
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        })
        setCalendarData(sortedData)
        fetchReads()
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

  // Load this viewer's comment read markers (independent of impersonation -
  // each authenticated user keeps their own unread state).
  const fetchReads = async () => {
    try {
      const response = await fetch('/api/calendar/reads')
      if (response.ok) {
        const result = await response.json()
        setReads(result.data || {})
      }
    } catch {
      // Non-fatal: without read markers everything just shows as unread.
    }
  }

  // Mark an item's comment thread as read up to now for this viewer, and clear
  // its unread badge optimistically.
  const markItemRead = async (itemId: string) => {
    const readAt = new Date().toISOString()
    setReads(prev => ({ ...prev, [itemId]: readAt }))
    try {
      await fetch('/api/calendar/reads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, readAt }),
      })
    } catch {
      // Optimistic update already applied; ignore transient failures.
    }
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
      const url = getApiUrl(`/api/calendar/${id}`)
      const response = await fetch(url, {
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

  const openCommentModal = (itemId: string, currentComments: CommentEntry[]) => {
    setCommentModal({
      isOpen: true,
      itemId,
      comments: currentComments || [],
      newComment: ''
    })
    // Opening the thread means the viewer has now seen these comments.
    markItemRead(itemId)
  }

  const addComment = async () => {
    if (commentModal.itemId && commentModal.newComment.trim()) {
      // Show comment update modal
      setUpdateModal({
        isOpen: true,
        message: 'Adding comment...',
        type: 'comment'
      })

      const authorRole = user?.role === 'admin' ? 'team' : 'client'
      const newEntry = createComment(commentModal.newComment.trim(), authorRole, new Date().toISOString())
      const updatedComments = [...commentModal.comments, newEntry]

      try {
        await updateCalendarItem(commentModal.itemId, { comments: updatedComments })
        // The author has obviously seen their own comment - keep it from
        // counting as unread to themselves.
        markItemRead(commentModal.itemId)
        
        // Send email notification
        try {
          const response = await fetch('/api/notifications/comment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              calendarItemId: commentModal.itemId,
              comment: commentModal.newComment.trim(),
            }),
          })
          
          if (!response.ok) {
            console.warn('Email notification failed:', await response.text())
          }
        } catch (emailError) {
          console.warn('Failed to send email notification:', emailError)
        }
        
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

  const deleteComment = async (commentIndex: number) => {
    if (commentModal.itemId && commentIndex >= 0 && commentIndex < commentModal.comments.length) {
      // Show comment update modal
      setUpdateModal({
        isOpen: true,
        message: 'Deleting comment...',
        type: 'comment'
      })

      const updatedComments = commentModal.comments.filter((_, index) => index !== commentIndex)
      
      try {
        await updateCalendarItem(commentModal.itemId, { comments: updatedComments })
        
        // Show success message
        setUpdateModal({
          isOpen: true,
          message: 'Comment deleted successfully!',
          type: 'comment'
        })
        
        // Update the modal state with the new comments
        setCommentModal(prev => ({
          ...prev,
          comments: updatedComments
        }))
        
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

  // Parse a stored item.date (e.g. "May 5" or "2026-05-05") into a Date.
  // Items stored without a year are anchored to the currently viewed month's
  // year so they don't drift across years.
  const parseItemDate = (raw: string, fallbackYear: number): Date | null => {
    if (!raw) return null
    const direct = new Date(raw)
    if (!isNaN(direct.getTime())) {
      // If the original string had no 4-digit year, normalize to fallback year
      const hasYear = /\b\d{4}\b/.test(raw)
      if (!hasYear) {
        return new Date(fallbackYear, direct.getMonth(), direct.getDate())
      }
      return direct
    }
    return null
  }

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // Group items by day within the currently visible month
  const itemsByDay: Record<string, ContentCalendarItem[]> = {}
  const monthsPresent = new Set<string>()
  calendarData.forEach(item => {
    const d = parseItemDate(item.date, viewMonth.getFullYear())
    if (!d) return
    monthsPresent.add(`${d.getFullYear()}-${d.getMonth()}`)
    if (d.getFullYear() === viewMonth.getFullYear() && d.getMonth() === viewMonth.getMonth()) {
      const k = dayKey(d)
      ;(itemsByDay[k] ||= []).push(item)
    }
  })

  // Sorted list of months that contain data, for the month chips
  const monthChips = Array.from(monthsPresent)
    .map(k => {
      const [y, m] = k.split('-').map(Number)
      return new Date(y, m, 1)
    })
    .sort((a, b) => a.getTime() - b.getTime())

  const selectedDayItems = selectedDayKey ? itemsByDay[selectedDayKey] || [] : []

  // Show Delete Confirmation Modal
  const showDeleteModal = (id: string, date: string) => {
    setDeleteModal({
      isOpen: true,
      itemId: id,
      itemDate: date
    })
  }

  // Delete Row Function
  const deleteCalendarItem = async () => {
    try {
      const url = getApiUrl(`/api/calendar/${deleteModal.itemId}`)
      const response = await fetch(url, {
        method: 'DELETE',
      })

      if (response.ok) {
        setCalendarData(prev => prev.filter(item => item.id !== deleteModal.itemId))
        
        // Close delete modal
        setDeleteModal({ isOpen: false, itemId: '', itemDate: '' })
        
        // Show success message
        setUpdateModal({
          isOpen: true,
          message: 'Calendar item deleted successfully!',
          type: 'team'
        })
        
        // Auto-hide after 2 seconds
        setTimeout(() => {
          setUpdateModal({ isOpen: false, message: '', type: null })
        }, 2000)
      } else {
        const error = await response.json()
        alert(`Failed to delete item: ${error.error}`)
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete item. Please try again.')
    }
  }

  // Open Regenerate Modal
  const openRegenerateModal = (
    itemId: string, 
    contentType: 'hook' | 'caption' | 'image_prompt_1' | 'image_prompt_2',
    currentContent: string,
    context: ContentCalendarItem
  ) => {
    setRegenerateModal({
      isOpen: true,
      itemId,
      contentType,
      currentContent,
      corrections: [],
      loading: false,
      context
    })
  }

  // Regenerate Content Function
  const regenerateContent = async () => {
    if (!regenerateModal.contentType || !regenerateModal.currentContent) return

    setRegenerateModal(prev => ({ ...prev, loading: true }))

    try {
      const contentTypeMap = {
        'hook': 'hook',
        'caption': 'caption',
        'image_prompt_1': 'image_prompt',
        'image_prompt_2': 'image_prompt'
      }

      // Map contentType to actual database field
      const fieldMap: Record<string, keyof ContentCalendarItem> = {
        'hook': 'hook',
        'caption': 'copy',
        'image_prompt_1': 'image_prompt_1',
        'image_prompt_2': 'image_prompt_2'
      }

      const response = await fetch('/api/regenerate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentContent: regenerateModal.currentContent,
          contentType: contentTypeMap[regenerateModal.contentType],
          corrections: regenerateModal.corrections,
          context: regenerateModal.context
        }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Update the calendar item with the regenerated content
        const fieldToUpdate = fieldMap[regenerateModal.contentType]
        const updates: Partial<ContentCalendarItem> = {
          [fieldToUpdate]: data.generatedContent
        }
        
        await updateCalendarItem(regenerateModal.itemId, updates)
        
        setRegenerateModal({
          isOpen: false,
          itemId: '',
          contentType: null,
          currentContent: '',
          corrections: [],
          loading: false,
          context: null
        })

        // Show success message
        setUpdateModal({
          isOpen: true,
          message: 'Content regenerated successfully!',
          type: 'team'
        })
        
        setTimeout(() => {
          setUpdateModal({ isOpen: false, message: '', type: null })
        }, 2000)
      } else {
        const error = await response.json()
        alert(`Failed to regenerate content: ${error.error}`)
        setRegenerateModal(prev => ({ ...prev, loading: false }))
      }
    } catch (err) {
      console.error('Regenerate error:', err)
      alert('Failed to regenerate content. Please try again.')
      setRegenerateModal(prev => ({ ...prev, loading: false }))
    }
  }

  // Generate Image Function
  const generateImage = async (prompt: string) => {
    setImageModal({
      isOpen: true,
      imageUrl: '',
      prompt,
      loading: true
    })

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      })

      if (response.ok) {
        const data = await response.json()
        setImageModal({
          isOpen: true,
          imageUrl: data.imageUrl,
          prompt,
          loading: false
        })
      } else {
        const error = await response.json()
        alert(`Failed to generate image: ${error.error}`)
        setImageModal({
          isOpen: false,
          imageUrl: '',
          prompt: '',
          loading: false
        })
      }
    } catch (err) {
      console.error('Image generation error:', err)
      alert('Failed to generate image. Please try again.')
      setImageModal({
        isOpen: false,
        imageUrl: '',
        prompt: '',
        loading: false
      })
    }
  }

  // Insert Empty Row Function
  const insertEmptyRow = async (selectedDate: string) => {
    try {
      const date = new Date(selectedDate)
      const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
      
      const newItem = {
        date: formattedDate,
        day: dayName,
        platform: ['Instagram'], // Default platform
        type: 'Post', // Default type
        hook: 'Add your engaging hook here...',
        copy: 'Write your compelling copy here...',
        kpi: 'Define your KPI (likes, shares, comments, etc.)',
        image_prompt_1: 'Describe your first image idea here...',
        image_prompt_2: 'Describe your second image idea here...',
        team_status: 'not-started',
        client_status: 'not-submitted',
        comments: [],
        is_new: true
      }

      const url = getApiUrl('/api/calendar')
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newItem),
      })

      if (response.ok) {
        const result = await response.json()
        setCalendarData(prev => {
          const updated = [...prev, result.data]
          return updated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        })
        
        setInsertModal(false)
        setSelectedDate('')
        
        // Show success message
        setUpdateModal({
          isOpen: true,
          message: 'New calendar item added with helpful prompts! Edit the placeholders to add your content.',
          type: 'team'
        })
        
        // Auto-hide after 2 seconds
        setTimeout(() => {
          setUpdateModal({ isOpen: false, message: '', type: null })
        }, 2000)
      } else {
        const error = await response.json()
        alert(`Failed to add new row: ${error.error}`)
      }
    } catch (err) {
      console.error('Insert row error:', err)
      alert('Failed to add new row. Please try again.')
    }
  }

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
            case 'content_type':
            case 'content type':
            case 'contenttype':
            case 'media_type':
            case 'media type':
            case 'format': {
              // Normalize to one of the supported content types
              const normalized = value.trim().toLowerCase()
              const contentTypeMap: Record<string, string> = {
                'video': 'Video',
                'still image': 'Still Image',
                'still': 'Still Image',
                'image': 'Still Image',
                'photo': 'Still Image',
                'carousel': 'Carousel',
                'animated flyer': 'Animated Flyer',
                'animated flyers': 'Animated Flyer',
                'flyer': 'Animated Flyer',
                'animation': 'Animated Flyer',
              }
              item.content_type = contentTypeMap[normalized] || (value ? value.trim() : '')
              break
            }
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
              // Handle comments - wrap CSV strings into comment objects.
              {
                const rawList = value ? (Array.isArray(value) ? value : value.split(' | ')) : []
                const nowISO = new Date().toISOString()
                item.comments = rawList
                  .map((c: string) => (typeof c === 'string' ? c.trim() : ''))
                  .filter((c: string) => c.length > 0)
                  .map((c: string) => createComment(c, 'unknown', nowISO))
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
      const url = getApiUrl('/api/calendar/bulk')
      const response = await fetch(url, {
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
        `"${Array.isArray(item.comments) ? item.comments.map(c => (typeof c === 'string' ? c : c?.text ?? '')).join(' | ').replace(/"/g, '""') : ''}"`
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

        {/* Admin Impersonation Banner */}
        {sessionStorage.getItem('admin_impersonate_client') && (
          <div className="bg-orange-500 text-white px-4 py-3 text-center relative">
            <div className="flex items-center justify-center gap-2">
              <UserIcon className="h-4 w-4" />
              <span className="font-medium">
                Admin Mode: Viewing {user?.company_name}'s dashboard
              </span>
              <button
                onClick={() => {
                  sessionStorage.removeItem('admin_impersonate_client')
                  router.push('/admin')
                }}
                className="ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
              >
                Exit & Return to Admin
              </button>
            </div>
          </div>
        )}

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={() => setInsertModal(true)}
                  className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-sm"
                >
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">Insert Row</div>
                    <div className="text-sm opacity-90">Add new empty item</div>
                  </div>
                </button>
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

          {/* Calendar Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg border border-gray-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]"></div>
            <div className="p-6 border-b border-gray-200 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-600)] rounded-lg">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-[var(--primary)]">Content Calendar</h3>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {viewMode === 'calendar' && (
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
                    <button
                      onClick={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-700"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        const n = new Date()
                        setViewMonth(new Date(n.getFullYear(), n.getMonth(), 1))
                      }}
                      className="px-3 py-1.5 text-sm font-semibold text-gray-800 min-w-[10rem] text-center"
                    >
                      {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </button>
                    <button
                      onClick={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-700"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-white text-[var(--primary)] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Calendar
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'table' ? 'bg-white text-[var(--primary)] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    <TableIcon className="h-4 w-4" />
                    Table
                  </button>
                </div>
              </div>
            </div>

            {viewMode === 'calendar' && monthChips.length > 0 && (
              <div className="px-6 pt-4 pb-2 flex flex-wrap items-center gap-2 border-b border-gray-100">
                <span className="text-xs uppercase tracking-wide text-gray-500 mr-1">Months with content:</span>
                {monthChips.map(m => {
                  const active = m.getFullYear() === viewMonth.getFullYear() && m.getMonth() === viewMonth.getMonth()
                  return (
                    <button
                      key={`${m.getFullYear()}-${m.getMonth()}`}
                      onClick={() => setViewMonth(new Date(m.getFullYear(), m.getMonth(), 1))}
                      className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${active ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                    >
                      {m.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </button>
                  )
                })}
              </div>
            )}

            {viewMode === 'calendar' ? (
              <div className="p-6">
                <MonthGrid
                  viewMonth={viewMonth}
                  itemsByDay={itemsByDay}
                  reads={reads}
                  onSelectDay={setSelectedDayKey}
                />
                {Object.keys(itemsByDay).length === 0 && (
                  <div className="mt-6 flex flex-col items-center justify-center space-y-3 text-center text-gray-500">
                    <div className="p-3 bg-gray-100 rounded-2xl">
                      <Calendar className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="text-sm">No content scheduled for {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</div>
                    <div className="text-xs text-gray-400">Use Insert Row or Upload CSV above to add items. Other months are preserved.</div>
                  </div>
                )}
              </div>
            ) : (
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
                    <th className="px-6 py-4 text-left font-semibold w-48">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span>KPI</span>
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
                        onDelete={showDeleteModal}
                        onGenerateImage={generateImage}
                        onRegenerateContent={openRegenerateModal}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Day Drawer */}
          {selectedDayKey && (
            <DayDrawer
              dayKey={selectedDayKey}
              items={selectedDayItems}
              onClose={() => setSelectedDayKey(null)}
              updatingId={updating}
              onUpdate={updateCalendarItem}
              onCopyCaption={handleCopyCaption}
              onOpenComment={openCommentModal}
              onDelete={showDeleteModal}
              onGenerateImage={generateImage}
              onRegenerateContent={openRegenerateModal}
              onAddForDay={(d) => {
                setSelectedDate(d)
                setInsertModal(true)
              }}
            />
          )}
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
                <li><strong>Content Type:</strong> "Content Type" or "Format" — Video, Still Image, Carousel, Animated Flyer</li>
                <li><strong>Prompts:</strong> "Image Prompt 1/2", "Prompt 1/2", or "Prompt1/2"</li>
                <li><strong>Status:</strong> Automatically validates and corrects invalid values</li>
                <li><strong>Comments:</strong> Comments, Notes, or Note</li>
              </ul>
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <strong>Heads up:</strong> Uploading replaces existing rows <em>only for the months present in your CSV</em>. Other months stay intact.
              </div>
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
                    <div key={comment.id || index} className="p-3 bg-gray-50 rounded-lg border group hover:bg-gray-100 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{comment.text}</p>
                          {(comment.authorRole !== 'unknown' || comment.createdAt > '1970') && (
                            <p className="mt-1 text-[11px] text-gray-400">
                              {comment.authorRole === 'team' ? 'Team' : comment.authorRole === 'client' ? 'Client' : ''}
                              {comment.authorRole !== 'unknown' && comment.createdAt > '1970' ? ' · ' : ''}
                              {comment.createdAt > '1970'
                                ? new Date(comment.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                                : ''}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteComment(index)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-all duration-200"
                          title="Delete comment"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
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
                className="px-4 py-2 text-white rounded-lg hover:opacity-90 bg-[#5843BE]"
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

      {/* Insert Row Modal */}
      {insertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-green-600" />
                Add New Calendar Item
              </h3>
              <button
                onClick={() => setInsertModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">
                Select a date for your new calendar item. The item will be created with helpful prompts that you can edit.
              </p>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setInsertModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedDate && insertEmptyRow(selectedDate)}
                disabled={!selectedDate}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Create Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                Delete Calendar Item
              </h3>
              <button
                onClick={() => setDeleteModal({ isOpen: false, itemId: '', itemDate: '' })}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    This action cannot be undone
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    The calendar item will be permanently deleted from your account.
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-gray-600">
                Are you sure you want to delete the calendar item for{' '}
                <span className="font-semibold text-gray-900">{deleteModal.itemDate}</span>?
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, itemId: '', itemDate: '' })}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteCalendarItem}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Generation Modal */}
      {imageModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Generated Image
              </h3>
              <button
                onClick={() => setImageModal({ isOpen: false, imageUrl: '', prompt: '', loading: false })}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-semibold text-gray-900">Prompt:</span> {imageModal.prompt}
              </p>
            </div>

            <div className="flex items-center justify-center bg-gray-50 rounded-xl p-8 min-h-[400px]">
              {imageModal.loading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 text-purple-600 animate-spin" />
                  <p className="text-sm text-gray-600">Generating your image...</p>
                </div>
              ) : imageModal.imageUrl ? (
                <img
                  src={imageModal.imageUrl}
                  alt="Generated image"
                  className="max-w-full max-h-[500px] rounded-lg shadow-lg"
                />
              ) : (
                <p className="text-sm text-gray-500">No image generated</p>
              )}
            </div>

            {!imageModal.loading && imageModal.imageUrl && (
              <div className="mt-6 flex justify-end space-x-3">
                <a
                  href={imageModal.imageUrl}
                  download="generated-image.png"
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Image
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Regenerate Content Modal */}
      {regenerateModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                Regenerate Content
              </h3>
              <button
                onClick={() => setRegenerateModal({
                  isOpen: false,
                  itemId: '',
                  contentType: null,
                  currentContent: '',
                  corrections: [],
                  loading: false,
                  context: null
                })}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                disabled={regenerateModal.loading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Current {regenerateModal.contentType === 'caption' ? 'Caption' : 
                           regenerateModal.contentType === 'hook' ? 'Hook' : 'Image Prompt'}:
                </p>
                <p className="text-xs text-blue-700 max-h-20 overflow-y-auto">
                  {regenerateModal.currentContent}
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What needs to be corrected? (Optional)
                </label>
                
                <div className="space-y-2">
                  {[
                    'Make it more engaging',
                    'Simplify the language',
                    'Add more details',
                    'Make it shorter',
                    'Make it more professional',
                    'Add emojis/hashtags'
                  ].map((correction) => (
                    <label key={correction} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={regenerateModal.corrections.includes(correction)}
                        onChange={(e) => {
                          const newCorrections = e.target.checked
                            ? [...regenerateModal.corrections, correction]
                            : regenerateModal.corrections.filter(c => c !== correction)
                          setRegenerateModal(prev => ({ ...prev, corrections: newCorrections }))
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        disabled={regenerateModal.loading}
                      />
                      <span className="text-gray-700">{correction}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setRegenerateModal({
                  isOpen: false,
                  itemId: '',
                  contentType: null,
                  currentContent: '',
                  corrections: [],
                  loading: false,
                  context: null
                })}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                disabled={regenerateModal.loading}
              >
                Cancel
              </button>
              <button
                onClick={regenerateContent}
                disabled={regenerateModal.loading}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              >
                {regenerateModal.loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </>
                )}
              </button>
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
  onOpenComment,
  onDelete,
  onGenerateImage,
  onRegenerateContent
}: {
  item: ContentCalendarItem
  index: number
  updating: boolean
  onUpdate: (id: string, updates: Partial<ContentCalendarItem>, updateType?: 'team' | 'client') => void
  onCopyCaption: (copy: string) => void
  onOpenComment: (itemId: string, comments: CommentEntry[]) => void
  onDelete: (id: string, date: string) => void
  onGenerateImage: (prompt: string) => void
  onRegenerateContent: (itemId: string, contentType: 'hook' | 'caption' | 'image_prompt_1' | 'image_prompt_2', currentContent: string, context: ContentCalendarItem) => void
}) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({
    date: item.date,
    day: item.day,
    platform: item.platform,
    type: item.type,
    hook: item.hook,
    copy: item.copy,
    kpi: item.kpi,
    image_prompt_1: item.image_prompt_1,
    image_prompt_2: item.image_prompt_2
  })

  const handleEditStart = (field: string) => {
    setEditingField(field)
    setEditValues({
      date: item.date,
      day: item.day,
      platform: item.platform,
      type: item.type,
      hook: item.hook,
      copy: item.copy,
      kpi: item.kpi,
      image_prompt_1: item.image_prompt_1,
      image_prompt_2: item.image_prompt_2
    })
  }

  const handleEditCancel = () => {
    setEditingField(null)
    setEditValues({
      date: item.date,
      day: item.day,
      platform: item.platform,
      type: item.type,
      hook: item.hook,
      copy: item.copy,
      kpi: item.kpi,
      image_prompt_1: item.image_prompt_1,
      image_prompt_2: item.image_prompt_2
    })
  }

  const handleEditSave = async (field: string) => {
    const updates: Partial<ContentCalendarItem> = {}
    
    if (field === 'date') {
      // When saving date, also save the day
      updates.date = editValues.date
      updates.day = editValues.day
    } else {
      updates[field as keyof ContentCalendarItem] = editValues[field as keyof typeof editValues] as any
    }
    
    await onUpdate(item.id, updates)
    setEditingField(null)
  }

  const handleInputChange = (field: string, value: string | string[]) => {
    setEditValues(prev => ({
      ...prev,
      [field]: value
    }))
  }
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
        {editingField === 'date' ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editValues.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#0a0a0a]"
              placeholder="Dec 9"
              autoFocus
            />
            <input
              type="text"
              value={editValues.day}
              onChange={(e) => handleInputChange('day', e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#0a0a0a]"
              placeholder="Monday"
            />
            <div className="flex gap-1">
              <button
                onClick={() => handleEditSave('date')}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                disabled={updating}
              >
                <Save className="h-3 w-3" />
                Save
              </button>
              <button
                onClick={handleEditCancel}
                className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                disabled={updating}
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group cursor-pointer" onClick={() => handleEditStart('date')}>
            <div className="font-bold text-green-700">{item.date}</div>
            <div className="text-xs text-gray-500">{item.day}</div>
            <div className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 mt-1">Click to edit</div>
            {item.is_new && <span className="inline-block bg-red-500 text-white text-xs px-2 py-1 rounded mt-1">NEW</span>}
          </div>
        )}
      </td>

      <td className="px-4 py-4">
        {editingField === 'platform' ? (
          <div className="space-y-2">
            <div className="space-y-1">
              {['Instagram', 'Facebook', 'Google', 'Stories', 'LinkedIn', 'Twitter', 'TikTok', 'YouTube'].map(platform => (
                <label key={platform} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editValues.platform.includes(platform)}
                    onChange={(e) => {
                      const newPlatforms = e.target.checked
                        ? [...editValues.platform, platform]
                        : editValues.platform.filter(p => p !== platform)
                      handleInputChange('platform', newPlatforms)
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[#0a0a0a]">{platform}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => handleEditSave('platform')}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                disabled={updating}
              >
                <Save className="h-3 w-3" />
                Save
              </button>
              <button
                onClick={handleEditCancel}
                className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                disabled={updating}
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group cursor-pointer" onClick={() => handleEditStart('platform')}>
            <div className="flex flex-wrap gap-1">
              {getPlatformTags(item.platform)}
            </div>
            <div className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 mt-1">Click to edit</div>
          </div>
        )}
      </td>

      <td className="px-4 py-4">
        {editingField === 'type' ? (
          <div className="space-y-2">
            <select
              value={editValues.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#0a0a0a]"
              autoFocus
            >
              <option value="Post">Post</option>
              <option value="Reel">Reel</option>
              <option value="Carousel">Carousel</option>
              <option value="Photo">Photo</option>
              <option value="Testimonial">Testimonial</option>
              <option value="Education">Education</option>
              <option value="Offer">Offer</option>
              <option value="Promo">Promo</option>
            </select>
            <div className="flex gap-1">
              <button
                onClick={() => handleEditSave('type')}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                disabled={updating}
              >
                <Save className="h-3 w-3" />
                Save
              </button>
              <button
                onClick={handleEditCancel}
                className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                disabled={updating}
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group cursor-pointer" onClick={() => handleEditStart('type')}>
            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full uppercase ${getTypeStyle(item.type)}`}>
              {item.type}
            </span>
            <div className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 mt-1">Click to edit</div>
          </div>
        )}
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
        {editingField === 'hook' ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editValues.hook}
              onChange={(e) => handleInputChange('hook', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-[#0a0a0a]"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleEditSave('hook')}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                disabled={updating}
              >
                <Save className="h-3 w-3" />
                Save
              </button>
              <button
                onClick={handleEditCancel}
                className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                disabled={updating}
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group flex items-center justify-between">
            <div className="font-semibold text-gray-900 text-sm flex-1">{item.hook}</div>
            <div className="flex gap-1">
              <button
                onClick={() => onRegenerateContent(item.id, 'hook', item.hook, item)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-blue-600 hover:text-blue-700 transition-all"
                title="Regenerate hook"
                disabled={!item.hook || item.hook.includes('Add your engaging')}
              >
                <RefreshCw className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleEditStart('hook')}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-black hover:text-blue-600 transition-all"
                title="Edit hook"
              >
                <Edit3 className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </td>

      <td className="px-4 py-4 max-w-md">
        {editingField === 'copy' ? (
          <div className="space-y-2">
            <div className="text-sm text-gray-900 font-semibold mb-2">Caption:</div>
            <textarea
              value={editValues.copy}
              onChange={(e) => handleInputChange('copy', e.target.value)}
              className="w-full h-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-[#0a0a0a]"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleEditSave('copy')}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                disabled={updating}
              >
                <Save className="h-3 w-3" />
                Save
              </button>
              <button
                onClick={handleEditCancel}
                className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                disabled={updating}
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm text-gray-900 font-semibold">Caption:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => onRegenerateContent(item.id, 'caption', item.copy, item)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-blue-600 hover:text-blue-700 transition-all"
                  title="Regenerate caption"
                  disabled={!item.copy || item.copy.includes('Write your compelling')}
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onCopyCaption(item.copy)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-green-600 hover:text-green-700 transition-all"
                  title="Copy caption"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleEditStart('copy')}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-black hover:text-blue-600 transition-all"
                  title="Edit caption"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto text-gray-900 p-3 bg-gray-50 rounded text-sm border">
              {item.copy.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        )}
      </td>

      <td className="px-4 py-4">
        {editingField === 'kpi' ? (
          <div className="space-y-2">
            <input
              type="text"
              value={editValues.kpi}
              onChange={(e) => handleInputChange('kpi', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-[#0a0a0a]"
              placeholder="Define your KPI..."
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleEditSave('kpi')}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                disabled={updating}
              >
                <Save className="h-3 w-3" />
                Save
              </button>
              <button
                onClick={handleEditCancel}
                className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                disabled={updating}
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="group cursor-pointer" onClick={() => handleEditStart('kpi')}>
            <div className="text-sm text-gray-900 p-3 bg-gray-50 rounded border min-h-[2.5rem] flex items-center">
              {item.kpi || 'Click to add KPI...'}
            </div>
            <div className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 mt-1">Click to edit</div>
          </div>
        )}
      </td>

      <td className="px-4 py-4 max-w-md">
        <div className="space-y-3">
          <div className="group">
            {editingField === 'image_prompt_1' ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-900 font-semibold mb-1">Prompt 1:</div>
                <textarea
                  value={editValues.image_prompt_1}
                  onChange={(e) => handleInputChange('image_prompt_1', e.target.value)}
                  className="w-full h-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-[#0a0a0a]"
                  autoFocus
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditSave('image_prompt_1')}
                    className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    disabled={updating}
                  >
                    <Save className="h-2 w-2" />
                    Save
                  </button>
                  <button
                    onClick={handleEditCancel}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                    disabled={updating}
                  >
                    <X className="h-2 w-2" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-gray-900 font-semibold">Prompt 1:</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onRegenerateContent(item.id, 'image_prompt_1', item.image_prompt_1, item)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-blue-600 hover:text-blue-700 transition-all"
                      title="Regenerate prompt 1"
                      disabled={!item.image_prompt_1 || item.image_prompt_1.includes('Describe your')}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => onGenerateImage(item.image_prompt_1)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-purple-600 hover:text-purple-700 transition-all"
                      title="Generate image from prompt 1"
                      disabled={!item.image_prompt_1 || item.image_prompt_1.includes('Describe your')}
                    >
                      <Sparkles className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleEditStart('image_prompt_1')}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-black hover:text-blue-600 transition-all"
                      title="Edit prompt 1"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="max-h-20 overflow-y-auto text-gray-900 p-2 bg-blue-50 rounded text-xs border">
                  {item.image_prompt_1 || 'No prompt provided'}
                </div>
              </div>
            )}
          </div>
          <div className="group">
            {editingField === 'image_prompt_2' ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-900 font-semibold mb-1">Prompt 2:</div>
                <textarea
                  value={editValues.image_prompt_2}
                  onChange={(e) => handleInputChange('image_prompt_2', e.target.value)}
                  className="w-full h-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-[#0a0a0a]"
                  autoFocus
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditSave('image_prompt_2')}
                    className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    disabled={updating}
                  >
                    <Save className="h-2 w-2" />
                    Save
                  </button>
                  <button
                    onClick={handleEditCancel}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                    disabled={updating}
                  >
                    <X className="h-2 w-2" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-gray-900 font-semibold">Prompt 2:</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onRegenerateContent(item.id, 'image_prompt_2', item.image_prompt_2, item)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-blue-600 hover:text-blue-700 transition-all"
                      title="Regenerate prompt 2"
                      disabled={!item.image_prompt_2 || item.image_prompt_2.includes('Describe your')}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => onGenerateImage(item.image_prompt_2)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-purple-600 hover:text-purple-700 transition-all"
                      title="Generate image from prompt 2"
                      disabled={!item.image_prompt_2 || item.image_prompt_2.includes('Describe your')}
                    >
                      <Sparkles className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleEditStart('image_prompt_2')}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-black hover:text-blue-600 transition-all"
                      title="Edit prompt 2"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="max-h-20 overflow-y-auto text-gray-900 p-2 bg-purple-50 rounded text-xs border">
                  {item.image_prompt_2 || 'No prompt provided'}
                </div>
              </div>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="space-y-2">
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
          <button
            onClick={() => onDelete(item.id, item.date)}
            className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white text-xs rounded hover:bg-red-700 w-full justify-center"
            title="Delete this item"
          >
            <Trash2 className="h-3 w-3" />
            <span>Delete</span>
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---------- Month Grid ----------
const PLATFORM_DOT_COLORS: Record<string, string> = {
  Instagram: 'bg-pink-500',
  Facebook: 'bg-blue-500',
  Google: 'bg-yellow-500',
  Stories: 'bg-purple-500',
  LinkedIn: 'bg-sky-600',
  Twitter: 'bg-slate-700',
  TikTok: 'bg-black',
  YouTube: 'bg-red-500',
}

const CLIENT_STATUS_BORDER: Record<string, string> = {
  'not-submitted': 'border-l-gray-300',
  'under-review': 'border-l-purple-500',
  'approved': 'border-l-green-500',
  'needs-changes': 'border-l-red-500',
}

function MonthGrid({
  viewMonth,
  itemsByDay,
  reads,
  onSelectDay,
}: {
  viewMonth: Date
  itemsByDay: Record<string, ContentCalendarItem[]>
  reads: Record<string, string>
  onSelectDay: (k: string) => void
}) {
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Build a 6-row x 7-col grid (always 42 cells)
  const cells: Array<{ date: Date; inMonth: boolean }> = []
  // Leading days from previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), inMonth: false })
  }
  // Days in current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true })
  }
  // Trailing days
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
  }

  const today = new Date()
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()

  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekdayLabels.map(w => (
          <div key={w} className="text-xs font-semibold text-gray-500 text-center py-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          const k = key(c.date)
          const items = c.inMonth ? itemsByDay[k] || [] : []
          const hasItems = items.length > 0
          const unreadCount = countUnreadForItems(items, reads)
          const commentCount = items.reduce((sum, it) => sum + (Array.isArray(it.comments) ? it.comments.length : 0), 0)
          return (
            <button
              key={i}
              onClick={() => c.inMonth && hasItems && onSelectDay(k)}
              disabled={!c.inMonth}
              className={`group relative text-left rounded-lg border min-h-[110px] p-2 transition-all ${
                c.inMonth
                  ? hasItems
                    ? 'bg-white border-gray-200 hover:border-[var(--primary)] hover:shadow-md cursor-pointer'
                    : 'bg-gray-50 border-gray-100 cursor-default'
                  : 'bg-gray-50/40 border-transparent text-gray-300 cursor-default'
              } ${isToday(c.date) && c.inMonth ? 'ring-2 ring-[var(--primary)]/40' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-semibold ${
                    isToday(c.date) && c.inMonth
                      ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--primary)] text-white'
                      : c.inMonth
                      ? 'text-gray-800'
                      : 'text-gray-300'
                  }`}
                >
                  {c.date.getDate()}
                </span>
                {commentCount > 0 && (
                  <span
                    title={
                      unreadCount > 0
                        ? `${unreadCount} new of ${commentCount} comment${commentCount === 1 ? '' : 's'}`
                        : `${commentCount} comment${commentCount === 1 ? '' : 's'}`
                    }
                    className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      unreadCount > 0 ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <MessageCircle className="w-2.5 h-2.5" />
                    {commentCount}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {items.slice(0, 3).map(it => {
                  const borderColor = CLIENT_STATUS_BORDER[it.client_status] || 'border-l-gray-300'
                  const primaryPlatform = it.platform?.[0]
                  const dot = primaryPlatform ? PLATFORM_DOT_COLORS[primaryPlatform] || 'bg-gray-400' : 'bg-gray-400'
                  const ctStyle = it.content_type ? CONTENT_TYPE_STYLES[it.content_type] : undefined
                  return (
                    <div
                      key={it.id}
                      className={`flex items-center gap-1.5 px-1.5 py-1 bg-gray-50 rounded text-[11px] border-l-2 ${borderColor} truncate`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                      {it.content_type && (
                        <span
                          className={`flex-shrink-0 text-[9px] leading-none px-1 py-0.5 rounded border ${ctStyle?.badge || 'bg-gray-100 text-gray-600 border-gray-200'}`}
                          title={it.content_type}
                        >
                          {ctStyle?.icon || ''} {it.content_type}
                        </span>
                      )}
                      <span className="truncate text-gray-700">{it.type}{it.hook ? ` · ${it.hook}` : ''}</span>
                    </div>
                  )
                })}
                {items.length > 3 && (
                  <div className="text-[10px] text-gray-500 pl-1">+{items.length - 3} more</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Day Drawer ----------
const PLATFORM_OPTIONS = ['Instagram', 'Facebook', 'Google', 'Stories', 'LinkedIn', 'Twitter', 'TikTok', 'YouTube']
const TYPE_OPTIONS = ['Post', 'Reel', 'Carousel', 'Photo', 'Testimonial', 'Education', 'Offer', 'Promo']
const CONTENT_TYPE_OPTIONS = ['Video', 'Still Image', 'Carousel', 'Animated Flyer']

const CONTENT_TYPE_STYLES: Record<string, { badge: string; dot: string; icon: string }> = {
  'Video': { badge: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500', icon: '🎬' },
  'Still Image': { badge: 'bg-sky-100 text-sky-700 border-sky-200', dot: 'bg-sky-500', icon: '🖼️' },
  'Carousel': { badge: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500', icon: '🎠' },
  'Animated Flyer': { badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', icon: '✨' },
}

const PLATFORM_BADGE_BG: Record<string, string> = {
  Instagram: 'bg-pink-500',
  Facebook: 'bg-blue-600',
  Google: 'bg-yellow-500',
  Stories: 'bg-purple-600',
  LinkedIn: 'bg-sky-600',
  Twitter: 'bg-slate-700',
  TikTok: 'bg-black',
  YouTube: 'bg-red-500',
}

const TEAM_STATUS_OPTIONS: Array<{ value: ContentCalendarItem['team_status']; label: string; ring: string }> = [
  { value: 'not-started', label: 'Not Started', ring: 'ring-gray-300' },
  { value: 'in-progress', label: 'In Progress', ring: 'ring-orange-300' },
  { value: 'ready-review', label: 'Ready for Review', ring: 'ring-blue-300' },
  { value: 'ready-post', label: 'Ready to Post', ring: 'ring-green-300' },
]

const CLIENT_STATUS_OPTIONS: Array<{ value: ContentCalendarItem['client_status']; label: string; ring: string }> = [
  { value: 'not-submitted', label: 'Not Submitted', ring: 'ring-gray-300' },
  { value: 'under-review', label: 'Under Review', ring: 'ring-purple-300' },
  { value: 'approved', label: 'Approved', ring: 'ring-green-300' },
  { value: 'needs-changes', label: 'Needs Changes', ring: 'ring-red-300' },
]

function teamStatusPill(status: string) {
  const map: Record<string, string> = {
    'not-started': 'bg-gray-100 text-gray-700 border-gray-200',
    'in-progress': 'bg-orange-100 text-orange-700 border-orange-200',
    'ready-review': 'bg-blue-100 text-blue-700 border-blue-200',
    'ready-post': 'bg-green-100 text-green-700 border-green-200',
  }
  return map[status] || map['not-started']
}

function clientStatusPill(status: string) {
  const map: Record<string, string> = {
    'not-submitted': 'bg-gray-100 text-gray-700 border-gray-200',
    'under-review': 'bg-purple-100 text-purple-700 border-purple-200',
    'approved': 'bg-green-100 text-green-700 border-green-200',
    'needs-changes': 'bg-red-100 text-red-700 border-red-200',
  }
  return map[status] || map['not-submitted']
}

function DayDrawer({
  dayKey,
  items,
  onClose,
  updatingId,
  onUpdate,
  onCopyCaption,
  onOpenComment,
  onDelete,
  onGenerateImage,
  onRegenerateContent,
  onAddForDay,
}: {
  dayKey: string
  items: ContentCalendarItem[]
  onClose: () => void
  updatingId: string | null
  onUpdate: (id: string, updates: Partial<ContentCalendarItem>, updateType?: 'team' | 'client') => void
  onCopyCaption: (copy: string) => void
  onOpenComment: (itemId: string, comments: CommentEntry[]) => void
  onDelete: (id: string, date: string) => void
  onGenerateImage: (prompt: string) => void
  onRegenerateContent: (itemId: string, contentType: 'hook' | 'caption' | 'image_prompt_1' | 'image_prompt_2', currentContent: string, context: ContentCalendarItem) => void
  onAddForDay: (isoDate: string) => void
}) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const dayDate = new Date(y, m - 1, d)
  const weekday = dayDate.toLocaleDateString('en-US', { weekday: 'long' })
  const monthDay = dayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const yearStr = dayDate.getFullYear()

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside className="w-full sm:max-w-2xl lg:max-w-3xl bg-gray-50 h-full overflow-y-auto shadow-2xl border-l border-gray-200 flex flex-col">
        {/* Sticky header */}
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200">
          <div className="px-6 py-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">
                {weekday}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">
                {monthDay} <span className="text-gray-400 font-medium">{yearStr}</span>
              </h2>
              <div className="text-sm text-gray-500 mt-1">
                {items.length} {items.length === 1 ? 'activity' : 'activities'} scheduled
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onAddForDay(dayKey)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Add activity
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 px-6 py-6 space-y-5">
          {items.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl py-16 text-center">
              <div className="inline-flex p-3 bg-gray-100 rounded-2xl mb-3">
                <Calendar className="h-7 w-7 text-gray-400" />
              </div>
              <div className="text-gray-700 font-medium">Nothing scheduled</div>
              <div className="text-sm text-gray-500 mt-1">Click "Add activity" to create one for this day.</div>
            </div>
          ) : (
            items.map(item => (
              <DayItemCard
                key={item.id}
                item={item}
                updating={updatingId === item.id}
                onUpdate={onUpdate}
                onCopyCaption={onCopyCaption}
                onOpenComment={onOpenComment}
                onDelete={onDelete}
                onGenerateImage={onGenerateImage}
                onRegenerateContent={onRegenerateContent}
              />
            ))
          )}
        </div>
      </aside>
    </div>
  )
}

// ---------- Day Item Card (vertical, drawer-friendly) ----------
function DayItemCard({
  item,
  updating,
  onUpdate,
  onCopyCaption,
  onOpenComment,
  onDelete,
  onGenerateImage,
  onRegenerateContent,
}: {
  item: ContentCalendarItem
  updating: boolean
  onUpdate: (id: string, updates: Partial<ContentCalendarItem>, updateType?: 'team' | 'client') => void
  onCopyCaption: (copy: string) => void
  onOpenComment: (itemId: string, comments: CommentEntry[]) => void
  onDelete: (id: string, date: string) => void
  onGenerateImage: (prompt: string) => void
  onRegenerateContent: (itemId: string, contentType: 'hook' | 'caption' | 'image_prompt_1' | 'image_prompt_2', currentContent: string, context: ContentCalendarItem) => void
}) {
  type EditField = 'hook' | 'copy' | 'kpi' | 'image_prompt_1' | 'image_prompt_2' | null
  const [editing, setEditing] = useState<EditField>(null)
  const [draft, setDraft] = useState<string>('')

  const startEdit = (field: Exclude<EditField, null>) => {
    setEditing(field)
    setDraft((item[field] as string) || '')
  }
  const cancelEdit = () => {
    setEditing(null)
    setDraft('')
  }
  const saveEdit = async () => {
    if (!editing) return
    await onUpdate(item.id, { [editing]: draft } as Partial<ContentCalendarItem>)
    setEditing(null)
  }

  const togglePlatform = (p: string) => {
    const next = item.platform.includes(p)
      ? item.platform.filter(x => x !== p)
      : [...item.platform, p]
    onUpdate(item.id, { platform: next })
  }

  return (
    <article className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${updating ? 'opacity-70 pointer-events-none' : ''}`}>
      {/* Card header strip */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {/* Type pill (editable via select) */}
            <select
              value={item.type}
              onChange={(e) => onUpdate(item.id, { type: e.target.value })}
              className="px-2.5 py-1 text-xs font-semibold rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 cursor-pointer"
            >
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Content type pill (editable via select) */}
            <select
              value={item.content_type || ''}
              onChange={(e) => onUpdate(item.id, { content_type: e.target.value })}
              className={`px-2.5 py-1 text-xs font-semibold rounded-full border focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 cursor-pointer ${
                item.content_type
                  ? CONTENT_TYPE_STYLES[item.content_type]?.badge || 'bg-gray-100 text-gray-700 border-gray-200'
                  : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}
              title="Content type"
            >
              <option value="">Content type…</option>
              {CONTENT_TYPE_OPTIONS.map(t => (
                <option key={t} value={t}>{CONTENT_TYPE_STYLES[t]?.icon} {t}</option>
              ))}
            </select>

            {/* Platform badges */}
            <div className="flex flex-wrap items-center gap-1">
              {item.platform.length === 0 && (
                <span className="text-xs text-gray-400 italic">No platforms</span>
              )}
              {item.platform.map(p => (
                <span
                  key={p}
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold text-white ${PLATFORM_BADGE_BG[p] || 'bg-gray-500'}`}
                >
                  {p}
                </span>
              ))}
            </div>

            {item.is_new && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                NEW
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onOpenComment(item.id, item.comments || [])}
              className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              title="Comments"
            >
              <MessageCircle className="h-4 w-4" />
              {item.comments && item.comments.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[var(--primary)] text-white text-[9px] font-bold rounded-full h-4 min-w-[1rem] px-1 flex items-center justify-center">
                  {item.comments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => onDelete(item.id, item.date)}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Platform picker (compact, click-to-toggle) */}
        <details className="mt-3 group">
          <summary className="list-none cursor-pointer text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 select-none">
            <Edit3 className="h-3 w-3" />
            Edit platforms
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PLATFORM_OPTIONS.map(p => {
              const active = item.platform.includes(p)
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    active
                      ? `text-white ${PLATFORM_BADGE_BG[p] || 'bg-gray-500'} border-transparent`
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </details>
      </div>

      {/* Body sections */}
      <div className="p-5 space-y-5">
        <EditableSection
          label="Hook"
          icon={<MessageCircle className="h-3.5 w-3.5" />}
          editing={editing === 'hook'}
          draft={draft}
          setDraft={setDraft}
          onEdit={() => startEdit('hook')}
          onSave={saveEdit}
          onCancel={cancelEdit}
          onRegenerate={() => onRegenerateContent(item.id, 'hook', item.hook, item)}
          value={item.hook}
          placeholder="Add a scroll-stopping hook..."
        />

        <EditableSection
          label="Caption"
          icon={<FileText className="h-3.5 w-3.5" />}
          editing={editing === 'copy'}
          draft={draft}
          setDraft={setDraft}
          onEdit={() => startEdit('copy')}
          onSave={saveEdit}
          onCancel={cancelEdit}
          onRegenerate={() => onRegenerateContent(item.id, 'caption', item.copy, item)}
          onCopy={() => onCopyCaption(item.copy)}
          value={item.copy}
          multiline
          placeholder="Write the caption / body copy..."
        />

        <EditableSection
          label="KPI"
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          editing={editing === 'kpi'}
          draft={draft}
          setDraft={setDraft}
          onEdit={() => startEdit('kpi')}
          onSave={saveEdit}
          onCancel={cancelEdit}
          value={item.kpi}
          placeholder="Define success (likes > 200, 5 DMs, etc.)"
        />

        {/* Image prompts — side-by-side on desktop, stacked on narrow */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ImagePromptSection
            label="Image Prompt 1"
            value={item.image_prompt_1}
            editing={editing === 'image_prompt_1'}
            draft={draft}
            setDraft={setDraft}
            onEdit={() => startEdit('image_prompt_1')}
            onSave={saveEdit}
            onCancel={cancelEdit}
            onRegenerate={() => onRegenerateContent(item.id, 'image_prompt_1', item.image_prompt_1, item)}
            onGenerate={() => onGenerateImage(item.image_prompt_1)}
          />
          <ImagePromptSection
            label="Image Prompt 2"
            value={item.image_prompt_2}
            editing={editing === 'image_prompt_2'}
            draft={draft}
            setDraft={setDraft}
            onEdit={() => startEdit('image_prompt_2')}
            onSave={saveEdit}
            onCancel={cancelEdit}
            onRegenerate={() => onRegenerateContent(item.id, 'image_prompt_2', item.image_prompt_2, item)}
            onGenerate={() => onGenerateImage(item.image_prompt_2)}
          />
        </div>
      </div>

      {/* Status footer */}
      <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatusSelect
          label="Our Team"
          icon={<Users className="h-3.5 w-3.5" />}
          value={item.team_status}
          options={TEAM_STATUS_OPTIONS}
          pillClass={teamStatusPill(item.team_status)}
          onChange={(v) => onUpdate(item.id, { team_status: v as ContentCalendarItem['team_status'] }, 'team')}
        />
        <StatusSelect
          label="Client"
          icon={<UserIcon className="h-3.5 w-3.5" />}
          value={item.client_status}
          options={CLIENT_STATUS_OPTIONS}
          pillClass={clientStatusPill(item.client_status)}
          onChange={(v) => onUpdate(item.id, { client_status: v as ContentCalendarItem['client_status'] }, 'client')}
        />
      </div>
    </article>
  )
}

function EditableSection({
  label,
  icon,
  value,
  editing,
  draft,
  setDraft,
  onEdit,
  onSave,
  onCancel,
  onRegenerate,
  onCopy,
  multiline,
  placeholder,
}: {
  label: string
  icon?: React.ReactNode
  value: string
  editing: boolean
  draft: string
  setDraft: (s: string) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onRegenerate?: () => void
  onCopy?: () => void
  multiline?: boolean
  placeholder?: string
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {icon}
          {label}
        </div>
        {!editing && (
          <div className="flex items-center gap-1">
            {onCopy && (
              <button onClick={onCopy} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500" title="Copy">
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
            {onRegenerate && (
              <button onClick={onRegenerate} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600" title="Regenerate with AI">
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500" title="Edit">
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {multiline ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 text-gray-900 resize-y"
              autoFocus
              placeholder={placeholder}
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 text-gray-900"
              autoFocus
              placeholder={placeholder}
            />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onSave} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
            <button onClick={onCancel} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={onEdit}
          className={`text-sm leading-relaxed text-gray-800 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-lg cursor-text hover:border-gray-300 transition-colors ${multiline ? 'whitespace-pre-wrap' : 'truncate'} ${!value ? 'italic text-gray-400' : ''}`}
        >
          {value || placeholder || 'Click to add...'}
        </div>
      )}
    </section>
  )
}

function ImagePromptSection({
  label,
  value,
  editing,
  draft,
  setDraft,
  onEdit,
  onSave,
  onCancel,
  onRegenerate,
  onGenerate,
}: {
  label: string
  value: string
  editing: boolean
  draft: string
  setDraft: (s: string) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onRegenerate: () => void
  onGenerate: () => void
}) {
  return (
    <section className="bg-blue-50/40 border border-blue-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
          <Image className="h-3.5 w-3.5" />
          {label}
        </div>
        {!editing && (
          <div className="flex items-center gap-1">
            <button onClick={onGenerate} disabled={!value} className="p-1.5 rounded-md hover:bg-blue-100 text-blue-700 disabled:opacity-40" title="Generate image">
              <Image className="h-3.5 w-3.5" />
            </button>
            <button onClick={onRegenerate} className="p-1.5 rounded-md hover:bg-blue-100 text-blue-700" title="Regenerate prompt">
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-blue-100 text-blue-700" title="Edit">
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-900 bg-white"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button onClick={onSave} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
            <button onClick={onCancel} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={onEdit}
          className={`text-xs leading-relaxed text-gray-800 whitespace-pre-wrap cursor-text bg-white/70 rounded-lg p-2.5 border border-blue-100 min-h-[3rem] ${!value ? 'italic text-gray-400' : ''}`}
        >
          {value || 'Describe the image you want...'}
        </div>
      )}
    </section>
  )
}

function StatusSelect({
  label,
  icon,
  value,
  options,
  pillClass,
  onChange,
}: {
  label: string
  icon?: React.ReactNode
  value: string
  options: Array<{ value: string; label: string }>
  pillClass: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
        {icon}
        {label}
      </div>
      <div className={`relative inline-flex w-full items-center rounded-lg border ${pillClass}`}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-transparent w-full pl-3 pr-8 py-2 text-sm font-medium focus:outline-none cursor-pointer"
        >
          {options.map(o => (
            <option key={o.value} value={o.value} className="bg-white text-gray-900">{o.label}</option>
          ))}
        </select>
        <ChevronRight className="h-3.5 w-3.5 absolute right-2 rotate-90 opacity-60 pointer-events-none" />
      </div>
    </label>
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
