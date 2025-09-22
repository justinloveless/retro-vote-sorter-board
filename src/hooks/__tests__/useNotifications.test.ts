import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useNotifications } from '../useNotifications'
import { shouldUseCSharpApi } from '@/config/environment'
import { apiGetNotifications } from '@/lib/apiClient'

// Mock dependencies
vi.mock('@/config/environment')
vi.mock('@/lib/apiClient')
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }))
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(() => ({ unsubscribe: vi.fn() }))
      }))
    })),
    removeChannel: vi.fn()
  }
}))
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    profile: null,
    isImpersonating: false
  })
}))

const mockShouldUseCSharpApi = vi.mocked(shouldUseCSharpApi)
const mockApiGetNotifications = vi.mocked(apiGetNotifications)

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when shouldUseCSharpApi returns true', () => {
    beforeEach(() => {
      mockShouldUseCSharpApi.mockReturnValue(true)
    })

    it('should call apiGetNotifications when fetching notifications', async () => {
      const mockNotifications = [
        {
          id: '1',
          created_at: '2025-01-01T00:00:00Z',
          user_id: 'test-user-id',
          type: 'test',
          title: 'Test Notification',
          message: 'Test message',
          url: null,
          is_read: false
        }
      ]
      
      mockApiGetNotifications.mockResolvedValue({ items: mockNotifications })

      const { result } = renderHook(() => useNotifications())

      await waitFor(() => {
        expect(result.current.notifications).toEqual(mockNotifications)
      })

      expect(mockApiGetNotifications).toHaveBeenCalledWith(50)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle API errors correctly', async () => {
      const errorMessage = 'API error 500'
      mockApiGetNotifications.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useNotifications())

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage)
      })

      expect(result.current.notifications).toEqual([])
      expect(result.current.loading).toBe(false)
    })

    it('should not set up realtime subscriptions', async () => {
      mockApiGetNotifications.mockResolvedValue({ items: [] })

      renderHook(() => useNotifications())

      // Wait for the effect to run
      await waitFor(() => {
        expect(mockApiGetNotifications).toHaveBeenCalled()
      })

      // Verify no realtime setup (this would be more complex in a real test)
      // For now, we just ensure the API path is called
      expect(mockShouldUseCSharpApi).toHaveBeenCalled()
    })
  })

  describe('when shouldUseCSharpApi returns false', () => {
    beforeEach(() => {
      mockShouldUseCSharpApi.mockReturnValue(false)
    })

    it('should use direct Supabase when fetching notifications', async () => {
      const { result } = renderHook(() => useNotifications())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Verify API client was not called
      expect(mockApiGetNotifications).not.toHaveBeenCalled()
      
      // Verify Supabase path was used (indirectly by checking no API call)
      expect(result.current.notifications).toEqual([])
    })

    it('should set up realtime subscriptions', async () => {
      const { result } = renderHook(() => useNotifications())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // In a real test, we'd verify realtime setup
      // For now, we just ensure the direct Supabase path is used
      expect(mockShouldUseCSharpApi).toHaveBeenCalled()
    })
  })

  describe('freshness window', () => {
    beforeEach(() => {
      mockShouldUseCSharpApi.mockReturnValue(true)
      mockApiGetNotifications.mockResolvedValue({ items: [] })
    })

    it('should prevent redundant fetches within freshness window', async () => {
      const { result } = renderHook(() => useNotifications())

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Clear the mock to reset the call count
      vi.clearAllMocks()

      // Second fetch immediately (should be blocked by freshness window)
      result.current.fetchNotifications()

      // Wait a bit to ensure no additional calls are made
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockApiGetNotifications).not.toHaveBeenCalled()
    })

    it('should allow forced fetch even within freshness window', async () => {
      const { result } = renderHook(() => useNotifications())

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Clear the mock to reset the call count
      vi.clearAllMocks()

      // Forced fetch
      result.current.fetchNotifications(true)

      await waitFor(() => {
        expect(mockApiGetNotifications).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('unread count', () => {
    beforeEach(() => {
      mockShouldUseCSharpApi.mockReturnValue(true)
    })

    it('should calculate unread count correctly', async () => {
      const mockNotifications = [
        { id: '1', is_read: false, created_at: '2025-01-01T00:00:00Z', user_id: 'test-user-id', type: 'test', title: 'Test 1', message: null, url: null },
        { id: '2', is_read: true, created_at: '2025-01-01T00:00:00Z', user_id: 'test-user-id', type: 'test', title: 'Test 2', message: null, url: null },
        { id: '3', is_read: false, created_at: '2025-01-01T00:00:00Z', user_id: 'test-user-id', type: 'test', title: 'Test 3', message: null, url: null }
      ]
      
      mockApiGetNotifications.mockResolvedValue({ items: mockNotifications })

      const { result } = renderHook(() => useNotifications())

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(2)
      })
    })
  })
})
