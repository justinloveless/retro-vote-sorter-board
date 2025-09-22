import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useTeamMembers } from '../useTeamMembers'
import { shouldUseCSharpApi } from '@/config/environment'
import { apiGetTeamMembers } from '@/lib/apiClient'

// Mock dependencies
vi.mock('@/config/environment')
vi.mock('@/lib/apiClient')
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    })),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ error: null }))
    },
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user-id' } } }))
    }
  }
}))
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

const mockShouldUseCSharpApi = vi.mocked(shouldUseCSharpApi)
const mockApiGetTeamMembers = vi.mocked(apiGetTeamMembers)

describe('useTeamMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when shouldUseCSharpApi returns true', () => {
    beforeEach(() => {
      mockShouldUseCSharpApi.mockReturnValue(true)
    })

    it('should call apiGetTeamMembers and map response correctly', async () => {
      const mockApiResponse = {
        items: [
          {
            teamId: 'team-123',
            userId: 'user-1',
            displayName: 'John Doe',
            email: 'john@example.com',
            role: 'admin'
          },
          {
            teamId: 'team-123',
            userId: 'user-2',
            displayName: 'Jane Smith',
            email: 'jane@example.com',
            role: 'member'
          }
        ]
      }
      
      mockApiGetTeamMembers.mockResolvedValue(mockApiResponse)

      const { result } = renderHook(() => useTeamMembers('team-123'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockApiGetTeamMembers).toHaveBeenCalledWith('team-123')
      
      // Verify the mapping from API response to internal format
      expect(result.current.members).toEqual([
        {
          id: 'user-1',
          team_id: 'team-123',
          user_id: 'user-1',
          role: 'admin',
          joined_at: '',
          profiles: { full_name: 'John Doe' }
        },
        {
          id: 'user-2',
          team_id: 'team-123',
          user_id: 'user-2',
          role: 'member',
          joined_at: '',
          profiles: { full_name: 'Jane Smith' }
        }
      ])
    })

    it('should handle API errors correctly', async () => {
      const errorMessage = 'API error 500'
      mockApiGetTeamMembers.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useTeamMembers('team-123'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.members).toEqual([])
      // Toast should be called with error message (mocked)
    })

    it('should handle empty API response', async () => {
      mockApiGetTeamMembers.mockResolvedValue({ items: [] })

      const { result } = renderHook(() => useTeamMembers('team-123'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.members).toEqual([])
    })

    it('should handle null teamId', async () => {
      const { result } = renderHook(() => useTeamMembers(null))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockApiGetTeamMembers).not.toHaveBeenCalled()
      expect(result.current.members).toEqual([])
    })
  })

  describe('when shouldUseCSharpApi returns false', () => {
    beforeEach(() => {
      mockShouldUseCSharpApi.mockReturnValue(false)
    })

    it('should use direct Supabase when loading team members', async () => {
      const { result } = renderHook(() => useTeamMembers('team-123'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify API client was not called
      expect(mockApiGetTeamMembers).not.toHaveBeenCalled()
      
      // Verify Supabase path was used (indirectly by checking no API call)
      expect(result.current.members).toEqual([])
    })

    it('should still load invitations using direct Supabase', async () => {
      const { result } = renderHook(() => useTeamMembers('team-123'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Invitations are always loaded via direct Supabase regardless of flag
      expect(result.current.invitations).toEqual([])
    })
  })

  describe('role mapping', () => {
    beforeEach(() => {
      mockShouldUseCSharpApi.mockReturnValue(true)
    })

    it('should default to member role when role is not provided', async () => {
      const mockApiResponse = {
        items: [
          {
            teamId: 'team-123',
            userId: 'user-1',
            displayName: 'John Doe',
            email: 'john@example.com'
            // No role provided
          }
        ]
      }
      
      mockApiGetTeamMembers.mockResolvedValue(mockApiResponse)

      const { result } = renderHook(() => useTeamMembers('team-123'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.members[0].role).toBe('member')
    })

    it('should handle null displayName', async () => {
      const mockApiResponse = {
        items: [
          {
            teamId: 'team-123',
            userId: 'user-1',
            displayName: null,
            email: 'john@example.com',
            role: 'admin'
          }
        ]
      }
      
      mockApiGetTeamMembers.mockResolvedValue(mockApiResponse)

      const { result } = renderHook(() => useTeamMembers('team-123'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.members[0].profiles?.full_name).toBeNull()
    })
  })
})
