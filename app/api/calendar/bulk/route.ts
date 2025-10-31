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

    // First, clear existing calendar data for this user
    const { error: deleteError } = await supabase
      .from('content_calendars')
      .delete()
      .eq('user_id', user.id)
    
    if (deleteError) {
      console.error('Error clearing existing data:', deleteError)
      return NextResponse.json({ error: 'Failed to clear existing data' }, { status: 500 })
    }

    // Prepare items with user_id and timestamps
    const calendarItems = items.map(item => ({
      ...item,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    // Insert new calendar data
    const { data: calendar, error } = await supabase
      .from('content_calendars')
      .insert(calendarItems)
      .select()

    console.log(calendar);

    if (error) {
      console.error('Error inserting calendar data:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      data: calendar,
      message: `Successfully uploaded ${calendarItems.length} calendar items`
    })
  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
