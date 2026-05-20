import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { items } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    // Check if admin is bulk uploading for a specific client
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

    // Determine which months are present in the uploaded CSV so we only
    // replace those months, leaving other months (e.g. prior planning) intact.
    const monthKey = (raw: string): string | null => {
      if (!raw) return null
      const d = new Date(raw)
      if (!isNaN(d.getTime())) return `${d.getFullYear()}-${d.getMonth()}`
      // Fallback: dates stored as "MMM D" (no year) — bucket by month name
      const m = String(raw).trim().match(/^([A-Za-z]+)/)
      return m ? m[1].slice(0, 3).toLowerCase() : null
    }

    const incomingMonths = new Set(
      items.map(i => monthKey(i.date)).filter((m): m is string => Boolean(m))
    )

    // Fetch existing rows for this user and delete only those whose month
    // matches one of the incoming months. Other months are preserved.
    const { data: existing, error: fetchError } = await supabase
      .from('content_calendars')
      .select('id, date')
      .eq('user_id', targetUserId)

    if (fetchError) {
      console.error('Error fetching existing data:', fetchError)
      return NextResponse.json({ error: 'Failed to read existing data' }, { status: 500 })
    }

    const idsToDelete = (existing || [])
      .filter(row => {
        const key = monthKey(row.date)
        return key !== null && incomingMonths.has(key)
      })
      .map(row => row.id)

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('content_calendars')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) {
        console.error('Error clearing months being replaced:', deleteError)
        return NextResponse.json({ error: 'Failed to clear months being replaced' }, { status: 500 })
      }
    }

    // Prepare items with user_id and timestamps
    const calendarItems = items.map(item => ({
      ...item,
      user_id: targetUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    // Insert new calendar data
    const { data: calendar, error } = await supabase
      .from('content_calendars')
      .insert(calendarItems)
      .select()
      .order('date', { ascending: true })

    console.log(calendar);

    if (error) {
      console.error('Error inserting calendar data:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: calendar,
      message: `Uploaded ${calendarItems.length} item${calendarItems.length === 1 ? '' : 's'}${idsToDelete.length ? `, replacing ${idsToDelete.length} existing row${idsToDelete.length === 1 ? '' : 's'} in the same month${incomingMonths.size === 1 ? '' : 's'}` : ''}.`,
      replacedCount: idsToDelete.length,
      months: Array.from(incomingMonths),
    })
  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
