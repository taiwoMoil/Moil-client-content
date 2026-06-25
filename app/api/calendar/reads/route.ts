import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Read markers are always keyed on the *authenticated* viewer, regardless of
// whose calendar is being viewed. An admin reviewing a client's calendar keeps
// their own unread state, so there is no client_id handling here.

// GET /api/calendar/reads -> { data: { [itemId]: lastReadAtISO } }
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('content_comment_reads')
      .select('item_id, last_read_at')
      .eq('user_id', user.id)

    if (error) {
      // Table not set up yet -> behave as "nothing read", so the UI still works.
      return NextResponse.json({ data: {} })
    }

    const map: Record<string, string> = {}
    for (const row of data || []) {
      map[row.item_id] = row.last_read_at
    }

    return NextResponse.json({ data: map })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/calendar/reads { itemId, readAt? } -> upsert last_read_at for viewer
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const itemId = body?.itemId
    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    }

    const lastReadAt =
      typeof body?.readAt === 'string' ? body.readAt : new Date().toISOString()

    const { error } = await supabase
      .from('content_comment_reads')
      .upsert(
        { user_id: user.id, item_id: itemId, last_read_at: lastReadAt },
        { onConflict: 'user_id,item_id' },
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { itemId, lastReadAt } })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
