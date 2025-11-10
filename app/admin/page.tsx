'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { User, ContentCalendarItem } from '@/lib/types/database'
import { Skeleton } from '@/components/ui/skeleton'
import { Metaballs } from '@paper-design/shaders-react'
import { 
  Users, Calendar, BarChart3, Settings, Eye, ChevronDown, ChevronRight, 
  Building, Mail, Clock, Activity, Shield, TrendingUp, UserCheck, 
  AlertCircle, CheckCircle, ArrowRight, Zap, Globe, Star, Crown,
  Search, Filter, MoreVertical, RefreshCw, Download, Upload
} from 'lucide-react'

interface ClientStats {
  totalItems: number
  completedItems: number
  pendingItems: number
  lastActivity: string
}

interface ClientWithStats extends User {
  stats: ClientStats
}

export default function AdminDashboard() {
  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [totalStats, setTotalStats] = useState({
    totalClients: 0,
    totalContent: 0,
    activeClients: 0
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      console.log('Auth user:', user)
      
      if (!user) {
        router.push('/login')
        return
      }

      // Get user profile to check role
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      console.log('User profile:', profile)
      console.log('Profile error:', profileError)

      if (profileError || !profile) {
        setError(`Failed to load user profile: ${profileError?.message || 'Unknown error'}`)
        return
      }

      if (profile.role !== 'admin') {
        setError(`Access denied. User role: ${profile.role}. Admin role required.`)
        return
      }

      setCurrentUser(profile)
      await loadClientsData()
    } catch (err) {
      console.error('Error checking admin access:', err)
      setError('Failed to verify admin access')
    }
  }

  const loadClientsData = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/admin/clients')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch clients data')
      }

      setClients(result.clients)
      setTotalStats(result.totalStats)

    } catch (err) {
      console.error('Error loading clients data:', err)
      setError('Failed to load clients data')
    } finally {
      setLoading(false)
    }
  }

  const handleViewClient = (clientId: string) => {
    // Store the client ID in session storage for impersonation
    sessionStorage.setItem('admin_impersonate_client', clientId)
    router.push('/dashboard')
  }

  const handleRefresh = () => {
    loadClientsData()
  }

  // Filter and search clients
  const filteredClients = clients.filter(client => {
    const matchesSearch = client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filterStatus === 'all') return matchesSearch
    
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(client.stats.lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    )
    
    const isActive = daysSinceActivity <= 30
    
    if (filterStatus === 'active') return matchesSearch && isActive
    if (filterStatus === 'inactive') return matchesSearch && !isActive
    
    return matchesSearch
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (client: ClientWithStats) => {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(client.stats.lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysSinceActivity <= 7) return 'text-green-600'
    if (daysSinceActivity <= 30) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 relative overflow-hidden">
        <Metaballs
          colors={["var(--primary)", "var(--secondary)"]}
          colorBack="#000000"
          count={8}
          size={0.6}
          speed={0.8}
          className="absolute inset-0 opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/95 to-gray-50/90" />
        <div className="relative z-10 max-w-7xl mx-auto p-6">
          <div className="mb-8">
            <Skeleton className="h-12 w-80 mb-4" />
            <Skeleton className="h-6 w-96 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 relative overflow-hidden flex items-center justify-center">
        <Metaballs
          colors={["var(--error)", "var(--warning)"]}
          colorBack="#000000"
          count={6}
          size={0.4}
          speed={0.5}
          className="absolute inset-0 opacity-10"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/95 to-red-50/90" />
        <div className="relative z-10 text-center max-w-md mx-auto p-8">
          <div className="p-4 bg-red-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-600)] text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Animated Background */}
      <Metaballs
        colors={["var(--primary)", "var(--secondary)", "#ffc105"]}
        colorBack="#000000"
        count={12}
        size={0.8}
        speed={1.2}
        className="absolute inset-0 opacity-15"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white/95 to-purple-50/80" />
      
      {/* Main Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-600)] rounded-xl">
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">
                    Admin Command Center
                  </h1>
                  <p className="text-gray-600 text-lg">Manage clients and monitor system performance</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  className="p-3 text-gray-600 hover:text-[var(--primary)] hover:bg-white/80 rounded-lg transition-all duration-200"
                  title="Refresh Data"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white/80 border border-gray-300 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200"
                >
                  <ArrowRight className="h-4 w-4 mr-2 inline" />
                  My Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6">
          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg p-6 border border-gray-200 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600"></div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Clients</p>
                  <p className="text-3xl font-bold text-gray-900">{totalStats.totalClients}</p>
                  <p className="text-sm text-blue-600 font-medium">All registered</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl group-hover:scale-110 transition-transform duration-200">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg p-6 border border-gray-200 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-600"></div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Content Items</p>
                  <p className="text-3xl font-bold text-gray-900">{totalStats.totalContent}</p>
                  <p className="text-sm text-green-600 font-medium">Total created</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl group-hover:scale-110 transition-transform duration-200">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg p-6 border border-gray-200 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-600"></div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Active Clients</p>
                  <p className="text-3xl font-bold text-gray-900">{totalStats.activeClients}</p>
                  <p className="text-sm text-purple-600 font-medium">Last 30 days</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl group-hover:scale-110 transition-transform duration-200">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg p-6 border border-gray-200 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-orange-600"></div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Engagement</p>
                  <p className="text-3xl font-bold text-gray-900">{Math.round((totalStats.activeClients / Math.max(totalStats.totalClients, 1)) * 100)}%</p>
                  <p className="text-sm text-orange-600 font-medium">Activity rate</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl group-hover:scale-110 transition-transform duration-200">
                  <Zap className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg p-6 border border-gray-200 mb-8">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                >
                  <option value="all">All Clients</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Filter className="h-4 w-4" />
                <span>{filteredClients.length} of {clients.length} clients</span>
              </div>
            </div>
          </div>

          {/* Enhanced Clients Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredClients.map((client) => {
              const daysSinceActivity = Math.floor(
                (Date.now() - new Date(client.stats.lastActivity).getTime()) / (1000 * 60 * 60 * 24)
              )
              const isActive = daysSinceActivity <= 30
              const completionRate = client.stats.totalItems > 0 ? Math.round((client.stats.completedItems / client.stats.totalItems) * 100) : 0

              return (
                <div key={client.id} className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg border border-gray-200 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isActive ? 'from-green-500 to-green-600' : 'from-gray-400 to-gray-500'}`}></div>
                  
                  <div className="p-6">
                    {/* Client Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${isActive ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
                          <Building className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{client.company_name}</h3>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-gray-900">{client.stats.totalItems}</p>
                        <p className="text-xs text-gray-600">Total Items</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{completionRate}%</p>
                        <p className="text-xs text-gray-600">Completed</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{client.stats.completedItems}/{client.stats.totalItems}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${completionRate}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Last Activity */}
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                      <Clock className="h-4 w-4" />
                      <span>Last active: {formatDate(client.stats.lastActivity)}</span>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => handleViewClient(client.id)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-600)] text-white rounded-lg font-medium hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Access Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty State */}
          {filteredClients.length === 0 && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl card-shadow-lg border border-gray-200 p-12 text-center">
              <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Users className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No clients found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || filterStatus !== 'all' 
                  ? 'Try adjusting your search or filter criteria.' 
                  : 'No client accounts have been created yet.'}
              </p>
              {(searchTerm || filterStatus !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setFilterStatus('all')
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-600)] text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
