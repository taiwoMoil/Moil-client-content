import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { clientId } = await request.json()

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the current user is an admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminError || !adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Verify the target client exists
    const { data: targetClient, error: clientError } = await supabase
      .from('users')
      .select('*')
      .eq('id', clientId)
      .eq('role', 'client')
      .single()

    if (clientError || !targetClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Return the client data for impersonation
    return NextResponse.json({ 
      success: true, 
      client: targetClient,
      message: `Successfully impersonating ${targetClient.company_name}` 
    })

  } catch (error) {
    console.error('Error in admin impersonation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
