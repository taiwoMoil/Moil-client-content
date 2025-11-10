import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify current user is admin
    const { data: adminProfile, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminError || !adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get all clients (non-admin users)
    const { data: clientsData, error: clientsError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'client')
      .order('created_at', { ascending: false })

    if (clientsError) {
      console.error('Error fetching clients:', clientsError)
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }

    // Get all content calendar items
    const { data: contentData, error: contentError } = await supabase
      .from('content_calendars')
      .select('*')

    if (contentError) {
      console.error('Error fetching content:', contentError)
      return NextResponse.json({ error: 'Failed to fetch content data' }, { status: 500 })
    }

    // Calculate stats for each client
    const clientsWithStats = clientsData.map(client => {
      const clientContent = contentData.filter(item => item.user_id === client.id)
      const completedItems = clientContent.filter(item => 
        item.team_status === 'ready-post' && item.client_status === 'approved'
      ).length
      
      const lastActivityItem = clientContent
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]

      return {
        ...client,
        stats: {
          totalItems: clientContent.length,
          completedItems,
          pendingItems: clientContent.length - completedItems,
          lastActivity: lastActivityItem ? lastActivityItem.updated_at : client.created_at
        }
      }
    })

    // Calculate total stats
    const activeClients = clientsWithStats.filter(client => 
      new Date(client.stats.lastActivity) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Active in last 30 days
    ).length

    const totalStats = {
      totalClients: clientsWithStats.length,
      totalContent: contentData.length,
      activeClients
    }

    return NextResponse.json({ 
      clients: clientsWithStats,
      totalStats
    })

  } catch (error) {
    console.error('Error in admin clients API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
