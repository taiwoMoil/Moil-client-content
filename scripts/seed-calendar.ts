// This script seeds the database with the calendar data from the original HTML
// Run with: npx tsx scripts/seed-calendar.ts
// NOTE: You need to add SUPABASE_SERVICE_ROLE_KEY to your .env.local file

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dpbitacfyksdpfmnyqje.supabase.co'
 const supabaseServiceKey = ''//'..tYiLyS1tlzIKiaO45lkwTVIGUOoRy9T_TKqG-APl65g'

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required for seeding data')
  console.log('Add this to your .env.local file:')
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here')
  console.log('\nYou can find the service role key in your Supabase dashboard under Settings > API')
  process.exit(1)
}

// Use service role key to bypass RLS for seeding
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const calendarData = [
  {
    date: "Oct 24", day: "Friday",
    platform: ["IG", "FB"],
    type: "reel",
    team_status: "not-started",
    client_status: "not-submitted",
    is_new: true,
    hook: "Smart Season 2025 is here, Buda!",
    copy: "🌞 Smart Season 2025 is here, Buda!\n\nYour Bermuda grass is STILL GROWING at 90°F – it needs nutrition, not neglect.\n\nOur 6-Round Premium Program keeps your lawn healthy year-round. Right now? ROUND 5 = Fall recovery time.\n\nWhat's included:\n✅ Fertilizer + weed killer combo\n✅ Fungus protection (heat diseases)\n✅ Pre-emergent for winter weeds\n\nThis is the FOUNDATION for spring green-up.\n\n📞 Buda/Kyle/Austin: (512) 694-1773",
    kpi: "Awareness + Engagement",
    image_prompt_1: "Time-lapse of brown patchy Bermuda grass transforming to vibrant green lawn, professional lawn care crew spraying in background, bright Texas sunlight, fall season, Buda TX residential setting",
    image_prompt_2: "Side-by-side comparison showing stressed brown lawn vs healthy green lawn after Fall Round 5 treatment, clear transformation, Buda neighborhood",
    comments: []
  },
  {
    date: "Oct 26", 
    day: "Sunday",
    platform: ["IG", "FB", "Stories"],
    type: "reel",
    team_status: "not-started",
    client_status: "not-submitted",
    is_new: true,
    hook: "⚡ URGENT: Rye Grass Overseeding - Fall Deadline!",
    copy: "⚡ URGENT: Rye Grass Overseeding - Fall Deadline!\n\nWant a GREEN lawn all winter?\n\nRye grass overseeding = Your Bermuda's winter blanket 🌱\n\nBenefits:\n✅ Stay green all winter (while neighbors go brown)\n✅ Erosion control during winter rains\n✅ Weed prevention (rye crowds out winter weeds)\n✅ Less mud tracked inside\n✅ Perfect for holiday photos!\n\nWHY THE FALL DEADLINE?\n→ Soil temps need to be 55-70°F for germination\n→ After fall = too cold for good establishment\n→ Need 2-3 weeks of growth before first freeze\n\n📞 CALL NOW: (512) 694-1773",
    kpi: "Urgent Service Revenue + Deadline Conversion",
    image_prompt_1: "Dramatic split screen reel showing brown dormant Bermuda lawn vs vibrant green rye grass overseed, same house winter comparison",
    image_prompt_2: "Close-up action shot of broadcast seeder spreading rye grass seed over prepared Bermuda lawn, professional equipment, fall season",
    comments: []
  },
  // Add more calendar items here...
  // For brevity, I'm including just the first 2 items
  // You can copy the rest from the original HTML calendarData array
]

async function seedCalendar(userId: string) {
  console.log('Starting calendar seed...')
  
  try {
    // First, clear existing calendar data for this user
    const { error: deleteError } = await supabase
      .from('content_calendars')
      .delete()
      .eq('user_id', userId)
    
    if (deleteError) {
      console.error('Error clearing existing data:', deleteError)
      return
    }

    // Insert new calendar data
    const calendarItems = calendarData.map(item => ({
      ...item,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    const { data, error } = await supabase
      .from('content_calendars')
      .insert(calendarItems)

    if (error) {
      console.error('Error seeding calendar:', error)
      return
    }

    console.log(`Successfully seeded ${calendarItems.length} calendar items`)
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Usage: Replace 'USER_ID_HERE' with the actual user ID from your Supabase auth
// You can get this from the Supabase dashboard or by signing up a user first
const USER_ID = 'dea741e6-184b-4292-9b15-557875877eee'

// if (USER_ID === 'USER_ID_HERE') {
//   console.log('Please replace USER_ID_HERE with an actual user ID')
//   process.exit(1)
// }

seedCalendar(USER_ID)
