'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { toast, Toaster } from 'react-hot-toast'
import { AutocompleteInput } from '../components/AutocompleteInput'
import { IncrementalSearch } from '../components/IncrementalSearch'

interface FriendRequest {
  id: string
  requester_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'blocked'
  created_at: string
  requester: {
    username: string
    grade_level: string
    total_points: number
  }
  recipient: {
    username: string
    grade_level: string
    total_points: number
  }
}

interface Friend {
  id: string
  username: string
  grade_level: string
  total_points: number
  friend_count: number
  last_active?: string
}

interface UserProfile {
  id: string
  username: string
  grade_level: string
  total_points: number
  friend_count: number
}

export default function FriendsPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends')

  useEffect(() => {
    fetchCurrentUser()
    fetchFriends()
    fetchFriendRequests()
  }, [])

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('users')
        .select('id, username, grade_level, total_points, friend_count')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setCurrentUser(data)
    } catch (err) {
      console.error('Error fetching current user:', err)
    }
  }

  const fetchFriends = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // get accepted friend relationships where current user is either requester or recipient
      const { data, error } = await supabase
        .from('friend_relationships')
        .select(`
          *,
          requester:users!requester_id(id, username, grade_level, total_points, friend_count),
          recipient:users!recipient_id(id, username, grade_level, total_points, friend_count)
        `)
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)

      if (error) throw error

      // transform data to get friend profiles
      const friendProfiles: Friend[] = data?.map(relationship => {
        const friend = relationship.requester_id === user.id 
          ? relationship.recipient 
          : relationship.requester
        return {
          id: friend.id,
          username: friend.username,
          grade_level: friend.grade_level,
          total_points: friend.total_points,
          friend_count: friend.friend_count
        }
      }) || []

      setFriends(friendProfiles)
    } catch (err) {
      console.error('Error fetching friends:', err)
      toast.error('Failed to load friends')
    }
  }

  const fetchFriendRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // get pending requests where current user is recipient
      const { data: receivedRequests, error: receivedError } = await supabase
        .from('friend_relationships')
        .select(`
          *,
          requester:users!requester_id(id, username, grade_level, total_points)
        `)
        .eq('recipient_id', user.id)
        .eq('status', 'pending')

      if (receivedError) throw receivedError

      // get pending requests where current user is requester
      const { data: sentRequests, error: sentError } = await supabase
        .from('friend_relationships')
        .select(`
          *,
          recipient:users!recipient_id(id, username, grade_level, total_points)
        `)
        .eq('requester_id', user.id)
        .eq('status', 'pending')

      if (sentError) throw sentError

      setPendingRequests(receivedRequests || [])
      setSentRequests(sentRequests || [])
    } catch (err) {
      console.error('Error fetching friend requests:', err)
      toast.error('Failed to load friend requests')
    } finally {
      setLoading(false)
    }
  }

  const searchUsers = async (query: string) => {
    try {
      console.log('Searching for:', query) // debug log
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
                  console.log('No authenticated user') // debug log
        return []
      }

      let { data, error } = await supabase
        .from('users')
        .select('id, username, grade_level, total_points, friend_count')
        .ilike('username', `%${query}%`)
        .neq('id', user.id)
        .limit(10)

      if (error) {
        console.error('Supabase error:', error) // debug log
        throw error
      }

              // if no results with specific search, try a broader search
      if (!data || data.length === 0) {
                  console.log('No specific results, trying broader search') // debug log
        const { data: broaderData, error: broaderError } = await supabase
          .from('users')
          .select('id, username, grade_level, total_points, friend_count')
          .neq('id', user.id)
          .limit(10)

        if (broaderError) {
          console.error('Broader search error:', broaderError) // debug log
          throw broaderError
        }

        data = broaderData
                  console.log('Broader search results:', data) // debug log
      }

              console.log('Final search results:', data) // debug log

      const formattedResults = (data || []).map(user => ({
        id: user.id,
        title: user.username,
        subtitle: `${user.grade_level} • ${user.total_points} points`,
        username: user.username,
        grade_level: user.grade_level,
        total_points: user.total_points,
        friend_count: user.friend_count
      }))

              console.log('Formatted results:', formattedResults) // debug log
      return formattedResults
    } catch (err) {
      console.error('Error searching users:', err)
      toast.error('Failed to search users')
      return []
    }
  }

  const handleUserSelect = (user: any) => {
    // handle user selection - could open a profile modal or navigate to profile
    console.log('Selected user:', user)
  }

      // test function to check if there are any users in the database
  const testUserFetch = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('No authenticated user')
        return
      }

              // test 1: get all users
      const { data: allUsers, error: allError } = await supabase
        .from('users')
        .select('*')
        .limit(5)

      console.log('All users test:', { allUsers, allError })

              // test 2: get current user
      const { data: currentUserData, error: currentError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      console.log('Current user test:', { currentUserData, currentError })

              // test 3: get users excluding current user
      const { data: otherUsers, error: otherError } = await supabase
        .from('users')
        .select('*')
        .neq('id', user.id)
        .limit(5)

      console.log('Other users test:', { otherUsers, otherError })

    } catch (err) {
      console.error('Test fetch error:', err)
    }
  }

  const sendFriendRequest = async (recipientId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('friend_relationships')
        .insert({
          requester_id: user.id,
          recipient_id: recipientId,
          status: 'pending'
        })

      if (error) throw error

      toast.success('Friend request sent!')
      fetchFriendRequests()
    } catch (err) {
      console.error('Error sending friend request:', err)
      toast.error('Failed to send friend request')
    }
  }

  const respondToFriendRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('friend_relationships')
        .update({ status })
        .eq('id', requestId)

      if (error) throw error

      toast.success(status === 'accepted' ? 'Friend request accepted!' : 'Friend request rejected')
      fetchFriendRequests()
      fetchFriends()
    } catch (err) {
      console.error('Error responding to friend request:', err)
      toast.error('Failed to respond to friend request')
    }
  }

  const removeFriend = async (friendId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('friend_relationships')
        .delete()
        .or(`and(requester_id.eq.${user.id},recipient_id.eq.${friendId}),and(requester_id.eq.${friendId},recipient_id.eq.${user.id})`)

      if (error) throw error

      toast.success('Friend removed')
      fetchFriends()
    } catch (err) {
      console.error('Error removing friend:', err)
      toast.error('Failed to remove friend')
    }
  }

  const isAlreadyFriend = (userId: string) => {
    return friends.some(friend => friend.id === userId)
  }

  const hasPendingRequest = (userId: string) => {
    return pendingRequests.some(request => request.requester_id === userId) ||
           sentRequests.some(request => request.recipient_id === userId)
  }

  const getRequestStatus = (userId: string) => {
    const received = pendingRequests.find(request => request.requester_id === userId)
    const sent = sentRequests.find(request => request.recipient_id === userId)
    
    if (received) return 'received'
    if (sent) return 'sent'
    return null
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8">
        <Toaster />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Friends</h1>
          <p className="text-gray-600">Connect with other students and compete together</p>
        </div>

        {/* current user stats */}
        {currentUser && (
          <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">Your Social Stats</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm opacity-90">Friends</p>
                    <p className="text-2xl font-bold">{currentUser.friend_count}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Total Points</p>
                    <p className="text-2xl font-bold">{currentUser.total_points}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-90">Grade Level</p>
                    <p className="text-2xl font-bold">{currentUser.grade_level}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* tab navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'friends'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'requests'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Requests ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Find Friends
          </button>
        </div>

        {/* content */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6">
              {activeTab === 'friends' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Friends</h3>
                  {friends.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p className="mb-4">You don't have any friends yet.</p>
                      <p>Search for friends to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {friends.map((friend) => (
                        <div key={friend.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-lg">
                                {friend.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{friend.username}</h4>
                              <p className="text-sm text-gray-500">{friend.grade_level} • {friend.total_points} points</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => removeFriend(friend.id)}
                              className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'requests' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Friend Requests</h3>
                  
                  {/* received requests */}
                  {pendingRequests.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-md font-medium text-gray-700 mb-3">Received Requests</h4>
                      <div className="space-y-3">
                        {pendingRequests.map((request) => (
                          <div key={request.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 font-semibold text-lg">
                                  {request.requester.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{request.requester.username}</h4>
                                <p className="text-sm text-gray-500">{request.requester.grade_level} • {request.requester.total_points} points</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => respondToFriendRequest(request.id, 'accepted')}
                                className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => respondToFriendRequest(request.id, 'rejected')}
                                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* sent requests */}
                  {sentRequests.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-700 mb-3">Sent Requests</h4>
                      <div className="space-y-3">
                        {sentRequests.map((request) => (
                          <div key={request.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                <span className="text-yellow-600 font-semibold text-lg">
                                  {request.recipient.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{request.recipient.username}</h4>
                                <p className="text-sm text-gray-500">{request.recipient.grade_level} • {request.recipient.total_points} points</p>
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              Pending...
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pendingRequests.length === 0 && sentRequests.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No pending friend requests.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'search' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Find Friends</h3>
                  
                  {/* test button */}
                  <div className="mb-4">
                    <button
                      onClick={testUserFetch}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                    >
                      Test User Fetch (Check Console)
                    </button>
                  </div>
                  
                  {/* incremental search */}
                  <div className="mb-6">
                    <IncrementalSearch
                      label="Search Users"
                      placeholder="Search by username..."
                      onSearch={searchUsers}
                      onSelect={handleUserSelect}
                      minChars={2}
                      debounceMs={300}
                      maxResults={10}
                      renderResult={(user, isHighlighted) => (
                        <div className={`p-4 ${isHighlighted ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-gray-600 font-semibold text-lg">
                                  {user.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{user.username}</h4>
                                <p className="text-sm text-gray-500">{user.grade_level} • {user.total_points} points</p>
                              </div>
                            </div>
                            <div>
                              {isAlreadyFriend(user.id) ? (
                                <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-md">
                                  Friends
                                </span>
                              ) : hasPendingRequest(user.id) ? (
                                <span className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-md">
                                  {getRequestStatus(user.id) === 'sent' ? 'Request Sent' : 'Request Received'}
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    sendFriendRequest(user.id)
                                  }}
                                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                  Add Friend
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    />
                  </div>

                  <div className="text-center py-8 text-gray-500">
                    <p>Start typing to search for users by username</p>
                    <p className="text-sm mt-2">Results will appear as you type</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
} 