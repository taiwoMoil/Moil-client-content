import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id } = await context.params // Properly await params

    // Validate that id is a valid UUID
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: 'Invalid ID provided' }, { status: 400 })
    }

    // Check if admin is updating content for a specific client
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

      targetUserId = clientId
    }

    const { data: calendar, error } = await supabase
      .from('content_calendars')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', targetUserId)
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params // Properly await params
    
    // Validate that id is a valid UUID
    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ error: 'Invalid ID provided' }, { status: 400 })
    }

    // Check if admin is deleting content for a specific client
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

      targetUserId = clientId
    }

    const { error } = await supabase
      .from('content_calendars')
      .delete()
      .eq('id', id)
      .eq('user_id', targetUserId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
