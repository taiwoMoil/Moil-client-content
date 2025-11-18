import { NextRequest, NextResponse } from 'next/server';
import { testEmailConfiguration } from '@/lib/email';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile || userProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Test email configuration
    const result = await testEmailConfiguration();
    
    if (result.success) {
      return NextResponse.json({ 
        message: 'Email configuration is working correctly',
        status: 'success'
      });
    } else {
      return NextResponse.json({ 
        message: 'Email configuration failed',
        error: result.error,
        status: 'error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error testing email configuration:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
