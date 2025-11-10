export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          company_name: string
          brand_color: string
          logo_url: string | null
          industry: string | null
          role: 'client' | 'admin'
          onedrive_team_review_link: string | null
          onedrive_client_dropoff_link: string | null
          onedrive_ready_schedule_link: string | null
          onedrive_status_report_link: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          company_name: string
          brand_color?: string
          logo_url?: string | null
          industry?: string | null
          role?: 'client' | 'admin'
          onedrive_team_review_link?: string | null
          onedrive_client_dropoff_link?: string | null
          onedrive_ready_schedule_link?: string | null
          onedrive_status_report_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          company_name?: string
          brand_color?: string
          logo_url?: string | null
          industry?: string | null
          role?: 'client' | 'admin'
          onedrive_team_review_link?: string | null
          onedrive_client_dropoff_link?: string | null
          onedrive_ready_schedule_link?: string | null
          onedrive_status_report_link?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      content_calendars: {
        Row: {
          id: string
          user_id: string
          date: string
          day: string
          platform: string[]
          type: string
          team_status: 'not-started' | 'in-progress' | 'ready-review' | 'ready-post'
          client_status: 'not-submitted' | 'under-review' | 'approved' | 'needs-changes'
          is_new: boolean
          hook: string
          copy: string
          kpi: string
          image_prompt_1: string
          image_prompt_2: string
          comments: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          day: string
          platform: string[]
          type: string
          team_status?: 'not-started' | 'in-progress' | 'ready-review' | 'ready-post'
          client_status?: 'not-submitted' | 'under-review' | 'approved' | 'needs-changes'
          is_new?: boolean
          hook: string
          copy: string
          kpi: string
          image_prompt_1: string
          image_prompt_2: string
          comments?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          day?: string
          platform?: string[]
          type?: string
          team_status?: 'not-started' | 'in-progress' | 'ready-review' | 'ready-post'
          client_status?: 'not-submitted' | 'under-review' | 'approved' | 'needs-changes'
          is_new?: boolean
          hook?: string
          copy?: string
          kpi?: string
          image_prompt_1?: string
          image_prompt_2?: string
          comments?: string[]
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type User = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type ContentCalendarItem = Database['public']['Tables']['content_calendars']['Row']
export type ContentCalendarInsert = Database['public']['Tables']['content_calendars']['Insert']
export type ContentCalendarUpdate = Database['public']['Tables']['content_calendars']['Update']
