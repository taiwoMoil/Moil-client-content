import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log(user)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if admin is requesting data for a specific client
    const { searchParams } = new URL(request.url)
    console.log(searchParams)
    const clientId = searchParams.get('client_id')
    console.log(clientId)
    
    let targetUserId = user.id

    if (clientId) {
      // Verify current user is admin
      const { data: adminProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!adminProfile || adminProfile.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }

      // Verify target client exists
      const { data: clientProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', clientId)
        .eq('role', 'client')
        .single()

      console.log(clientProfile)

      if (!clientProfile) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }

      targetUserId = clientId
    }

    console.log(targetUserId)

    const { data: calendar, error } = await supabase
      .from('content_calendars')
      .select('*')
      .eq('user_id', targetUserId)
      .order('date', { ascending: true })

    console.log(calendar)
    console.log(error)

    if (error) {
      // Handle table not found error gracefully
      if (error.message.includes('content_calendars') && error.message.includes('schema cache')) {
        return NextResponse.json({ 
          error: 'Database tables not set up. Please run the database schema first.',
          data: [] 
        }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: calendar || [] })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Check if admin is creating content for a specific client
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('client_id')
    
    let targetUserId = user.id

    if (clientId) {
      // Verify current user is admin
      const { data: adminProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!adminProfile || adminProfile.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }

      // Verify target client exists
      const { data: clientProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', clientId)
        .eq('role', 'client')
        .single()

      if (!clientProfile) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }

      targetUserId = clientId
    }
    
    const { data: calendar, error } = await supabase
      .from('content_calendars')
      .insert([{ ...body, user_id: targetUserId }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: calendar })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
