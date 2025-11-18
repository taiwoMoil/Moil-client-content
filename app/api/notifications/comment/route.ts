import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendAdminCommentNotification, sendUserCommentNotification, EmailNotificationData } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { calendarItemId, comment } = body;

    if (!calendarItemId || !comment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the calendar item details
    const { data: calendarItem, error: calendarError } = await supabase
      .from('content_calendars')
      .select('*')
      .eq('id', calendarItemId)
      .single();

    if (calendarError || !calendarItem) {
      return NextResponse.json({ error: 'Calendar item not found' }, { status: 404 });
    }

    // Get the current user's profile to check if they're an admin
    const { data: currentUserProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !currentUserProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get the client information (owner of the calendar item)
    const { data: clientProfile, error: clientError } = await supabase
      .from('users')
      .select('*')
      .eq('id', calendarItem.user_id)
      .single();

    if (clientError || !clientProfile) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    // Format the date for display
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    };

    // Prepare email data
    const emailData: EmailNotificationData = {
      clientName: clientProfile.full_name || clientProfile.email,
      clientEmail: clientProfile.email,
      comment: comment,
      calendarDate: formatDate(calendarItem.date),
      calendarItem: {
        id: calendarItem.id,
        date: calendarItem.date,
        platform: calendarItem.platform || [],
        type: calendarItem.type || '',
        hook: calendarItem.hook || '',
        copy: calendarItem.copy || '',
      },
      dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`,
    };

    let emailResult;

    // Check if the current user is an admin commenting on someone else's calendar
    const isAdminComment = currentUserProfile.role === 'admin' && currentUserProfile.id !== calendarItem.user_id;

    if (isAdminComment) {
      // Admin is commenting on a client's calendar item
      emailResult = await sendAdminCommentNotification({
        ...emailData,
        adminName: currentUserProfile.full_name || currentUserProfile.email,
      });
    } else {
      // User is commenting on their own calendar item
      emailResult = await sendUserCommentNotification(emailData);
    }

    if (emailResult.success) {
      return NextResponse.json({ 
        message: 'Email notification sent successfully',
        messageId: emailResult.messageId 
      });
    } else {
      console.error('Failed to send email notification:', emailResult.error);
      // Don't fail the request if email fails - just log it
      return NextResponse.json({ 
        message: 'Comment processed, but email notification failed',
        error: emailResult.error 
      }, { status: 200 });
    }

  } catch (error) {
    console.error('Error in comment notification API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
