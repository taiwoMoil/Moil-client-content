'use client'

import { User } from '@/lib/types/database'
import { Calendar, Settings, BarChart3, LogOut, Building2, User as UserIcon, Bell, Search, Shield } from 'lucide-react'
import Link from 'next/link'

interface ClientBrandingProps {
  user: User | null
  children: React.ReactNode
}

export function ClientBranding({ user, children }: ClientBrandingProps) {
  if (!user) {
    return <div>{children}</div>
  }

  // Apply user-specific CSS variables (user IS the client)
  const style = {
    '--client-primary': user.brand_color,
    '--client-primary-dark': adjustBrightness(user.brand_color, -20),
    '--client-primary-light': adjustBrightness(user.brand_color, 20),
  } as React.CSSProperties

  return (
    <div style={style} className="client-branded">
      {children}
    </div>
  )
}

// Utility function to adjust color brightness
function adjustBrightness(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace('#', '')
  
  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  // Adjust brightness
  const adjust = (color: number) => {
    const adjusted = color + (color * percent / 100)
    return Math.max(0, Math.min(255, Math.round(adjusted)))
  }
  
  const newR = adjust(r)
  const newG = adjust(g)
  const newB = adjust(b)
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`
}

// User-specific header component (user IS the client)
interface ClientHeaderProps {
  user: User | null
  userEmail: string
  onLogout: () => void
}

export function ClientHeader({ user, userEmail, onLogout }: ClientHeaderProps) {
  const getIndustryIcon = (industry: string | null) => {
    switch (industry?.toLowerCase()) {
      case 'landscaping':
        return Building2
      case 'technology':
        return Settings
      case 'fitness':
        return BarChart3
      case 'food':
        return Calendar
      default:
        return Building2
    }
  }

  const getClientIndustryContext = (industry: string | null) => {
    switch (industry?.toLowerCase()) {
      case 'landscaping':
        return 'Seasonal Content Strategy'
      case 'technology':
        return 'Digital Marketing Calendar'
      case 'fitness':
        return 'Wellness Content Planning'
      case 'food':
        return 'Culinary Content Calendar'
      default:
        return 'Content Calendar Dashboard'
    }
  }

  if (!user) {
    return (
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-600)] rounded-xl">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">MOIL CALENDAR</h1>
                <p className="text-gray-500 text-sm">Enterprise Content Management Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-gray-600 text-sm">Welcome, {userEmail}</span>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>
    )
  }

  const companyName = user.company_name || 'My Company'
  const IndustryIcon = getIndustryIcon(user.industry)

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-white/95">
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Brand Section */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {user.logo_url ? (
                <img 
                  src={user.logo_url} 
                  alt={`${companyName} logo`}
                  className="h-10 w-10 rounded-xl object-cover border border-gray-200"
                />
              ) : (
                <div className="p-2 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-600)] rounded-xl">
                  <IndustryIcon className="h-6 w-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">{companyName}</h1>
                <p className="text-gray-500 text-xs">{getClientIndustryContext(user.industry)}</p>
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-1">
              <button className="flex items-center gap-2 px-4 py-2 text-[var(--primary)] bg-[var(--primary-50)] rounded-lg font-medium text-sm">
                <Calendar className="h-4 w-4" />
                <span>Calendar</span>
              </button>
              {user.role === 'admin' && !sessionStorage.getItem('admin_impersonate_client') && (
                <Link 
                  href="/admin"
                  className="flex items-center gap-2 px-4 py-2 text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg font-medium text-sm transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin</span>
                </Link>
              )}
            </nav>

            {/* User Section */}
            <div className="flex items-center gap-3 ml-6 pl-6 border-l border-gray-200">
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all duration-200">
                <Bell className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">{userEmail.split('@')[0]}</div>
                  <div className="text-xs text-gray-500">{userEmail.split('@')[1]}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <UserIcon className="h-4 w-4 text-gray-600" />
                  </div>
                  <button
                    onClick={onLogout}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
