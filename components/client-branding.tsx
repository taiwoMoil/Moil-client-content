'use client'

import { User } from '@/lib/types/database'

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
  const getClientIcon = (companyName: string) => {
    switch (companyName.toLowerCase()) {
      case 'rosales yard maintenance':
        return '🌿'
      case 'tech solutions':
        return '💻'
      case 'fitness plus':
        return '💪'
      case 'food delights':
        return '🍕'
      default:
        return '📅'
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
      <header className="bg-gradient-to-r from-blue-700 to-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">📅 MOIL CALENDAR</h1>
              <p className="text-blue-100 mt-1">Multi-Client Content Management Platform</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-blue-100">Welcome, {userEmail}</span>
              <button
                onClick={onLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>
    )
  }

  const primaryColor = user.brand_color
  const darkColor = adjustBrightness(primaryColor, -20)
  const companyName = user.company_name || 'My Company'

  return (
    <header 
      className="text-white shadow-lg"
      style={{
        background: `linear-gradient(to right, ${primaryColor}, ${darkColor})`
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {user.logo_url ? (
              <img 
                src={user.logo_url} 
                alt={`${companyName} logo`}
                className="h-12 w-12 rounded-lg bg-white p-1"
              />
            ) : (
              <div className="text-4xl">
                {getClientIcon(companyName)}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold">{companyName.toUpperCase()}</h1>
              <p className="opacity-90 mt-1">{getClientIndustryContext(user.industry)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="opacity-90">Welcome, {userEmail}</span>
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors hover:bg-black hover:bg-opacity-20"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            >
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
