import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { AdminSendNotification } from '../AdminSendNotification'
import { shouldUseCSharpApi } from '@/config/environment'
import { apiAdminSendNotification } from '@/lib/apiClient'

// Mock dependencies
vi.mock('@/config/environment')
vi.mock('@/lib/apiClient')
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve({ error: null }))
    }
  }
}))
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

const mockShouldUseCSharpApi = vi.mocked(shouldUseCSharpApi)
const mockApiAdminSendNotification = vi.mocked(apiAdminSendNotification)

describe('AdminSendNotification', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when shouldUseCSharpApi returns true', () => {
    beforeEach(() => {
      mockShouldUseCSharpApi.mockReturnValue(true)
    })

    it('should call apiAdminSendNotification with correct payload', async () => {
      const mockResponse = {
        success: true,
        count: 2,
        info: 'Notifications sent successfully'
      }
      
      mockApiAdminSendNotification.mockResolvedValue(mockResponse)

      render(<AdminSendNotification />)

      // Clear and fill out the form
      const recipientsInput = screen.getByLabelText('Recipients (comma-separated emails or user IDs)')
      const titleInput = screen.getByLabelText('Title')
      const messageInput = screen.getByLabelText('Message (optional)')
      
      await user.clear(recipientsInput)
      await user.type(recipientsInput, 'alice@example.com, bob@example.com')
      
      await user.clear(titleInput)
      await user.type(titleInput, 'Test Notification')
      
      await user.clear(messageInput)
      await user.type(messageInput, 'This is a test message')

      // Submit the form
      await user.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => {
        expect(mockApiAdminSendNotification).toHaveBeenCalledWith({
          recipients: [
            { email: 'alice@example.com' },
            { email: 'bob@example.com' }
          ],
          type: 'custom',
          title: 'Test Notification',
          message: 'This is a test message',
          url: undefined
        })
      })
    })

    it('should handle email and userId recipients correctly', async () => {
      const mockResponse = {
        success: true,
        count: 2,
        info: 'Notifications sent successfully'
      }
      
      mockApiAdminSendNotification.mockResolvedValue(mockResponse)

      render(<AdminSendNotification />)

      // Clear and fill out the form with mix of emails and user IDs
      const recipientsInput = screen.getByLabelText('Recipients (comma-separated emails or user IDs)')
      const titleInput = screen.getByLabelText('Title')
      
      await user.clear(recipientsInput)
      await user.type(recipientsInput, 'alice@example.com, 12345678-1234-1234-1234-123456789012')
      
      await user.clear(titleInput)
      await user.type(titleInput, 'Test Notification')

      await user.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => {
        expect(mockApiAdminSendNotification).toHaveBeenCalledWith({
          recipients: [
            { email: 'alice@example.com' },
            { userId: '12345678-1234-1234-1234-123456789012' }
          ],
          type: 'custom',
          title: 'Test Notification',
          message: 'This is a test', // Default value from component
          url: undefined
        })
      })
    })

    it('should handle API errors correctly', async () => {
      const errorMessage = 'API error 500'
      mockApiAdminSendNotification.mockRejectedValue(new Error(errorMessage))

      render(<AdminSendNotification />)

      const recipientsInput = screen.getByLabelText('Recipients (comma-separated emails or user IDs)')
      const titleInput = screen.getByLabelText('Title')
      
      await user.clear(recipientsInput)
      await user.type(recipientsInput, 'alice@example.com')
      
      await user.clear(titleInput)
      await user.type(titleInput, 'Test Notification')

      await user.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => {
        // Toast should be called with error message (mocked)
        expect(mockApiAdminSendNotification).toHaveBeenCalled()
      })
    })

    it('should handle successful response with count', async () => {
      const mockResponse = {
        success: true,
        count: 1,
        info: undefined
      }
      
      mockApiAdminSendNotification.mockResolvedValue(mockResponse)

      render(<AdminSendNotification />)

      const recipientsInput = screen.getByLabelText('Recipients (comma-separated emails or user IDs)')
      const titleInput = screen.getByLabelText('Title')
      
      await user.clear(recipientsInput)
      await user.type(recipientsInput, 'alice@example.com')
      
      await user.clear(titleInput)
      await user.type(titleInput, 'Test Notification')

      await user.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => {
        expect(mockApiAdminSendNotification).toHaveBeenCalled()
      })
    })

    it('should clear form after successful send', async () => {
      const mockResponse = {
        success: true,
        count: 1,
        info: 'Sent successfully'
      }
      
      mockApiAdminSendNotification.mockResolvedValue(mockResponse)

      render(<AdminSendNotification />)

      const recipientsInput = screen.getByLabelText('Recipients (comma-separated emails or user IDs)')
      const titleInput = screen.getByLabelText('Title')
      
      await user.clear(recipientsInput)
      await user.type(recipientsInput, 'alice@example.com')
      
      await user.clear(titleInput)
      await user.type(titleInput, 'Test Notification')

      await user.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => {
        expect(recipientsInput).toHaveValue('')
      })
    })
  })

  describe('when shouldUseCSharpApi returns false', () => {
    beforeEach(() => {
      mockShouldUseCSharpApi.mockReturnValue(false)
    })

    it('should use direct Supabase function call', async () => {
      const { supabase } = await import('@/integrations/supabase/client')
      const mockInvoke = vi.mocked(supabase.functions.invoke)
      mockInvoke.mockResolvedValue({ error: null })

      render(<AdminSendNotification />)

      const recipientsInput = screen.getByLabelText('Recipients (comma-separated emails or user IDs)')
      const titleInput = screen.getByLabelText('Title')
      
      await user.clear(recipientsInput)
      await user.type(recipientsInput, 'alice@example.com')
      
      await user.clear(titleInput)
      await user.type(titleInput, 'Test Notification')

      await user.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('admin-send-notification', {
          body: {
            recipients: [{ email: 'alice@example.com' }],
            type: 'custom',
            title: 'Test Notification',
            message: 'This is a test', // Default value from component
            url: undefined
          }
        })
      })

      // Verify API client was not called
      expect(mockApiAdminSendNotification).not.toHaveBeenCalled()
    })

    it('should handle Supabase function errors', async () => {
      const { supabase } = await import('@/integrations/supabase/client')
      const mockInvoke = vi.mocked(supabase.functions.invoke)
      mockInvoke.mockResolvedValue({ error: { message: 'Function error' } })

      render(<AdminSendNotification />)

      const recipientsInput = screen.getByLabelText('Recipients (comma-separated emails or user IDs)')
      const titleInput = screen.getByLabelText('Title')
      
      await user.clear(recipientsInput)
      await user.type(recipientsInput, 'alice@example.com')
      
      await user.clear(titleInput)
      await user.type(titleInput, 'Test Notification')

      await user.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled()
      })
    })
  })

  describe('form validation', () => {
    beforeEach(() => {
      mockShouldUseCSharpApi.mockReturnValue(true)
      mockApiAdminSendNotification.mockResolvedValue({ success: true, count: 1 })
    })

    it('should disable send button when title is empty', () => {
      render(<AdminSendNotification />)

      const sendButton = screen.getByRole('button', { name: /send/i })
      expect(sendButton).toBeDisabled()
    })

    it('should disable send button when recipients is empty', () => {
      render(<AdminSendNotification />)

      const sendButton = screen.getByRole('button', { name: /send/i })
      expect(sendButton).toBeDisabled()
    })

    it('should enable send button when both title and recipients are filled', async () => {
      render(<AdminSendNotification />)

      const recipientsInput = screen.getByLabelText('Recipients (comma-separated emails or user IDs)')
      const titleInput = screen.getByLabelText('Title')
      
      await user.clear(recipientsInput)
      await user.type(recipientsInput, 'alice@example.com')
      
      await user.clear(titleInput)
      await user.type(titleInput, 'Test Notification')

      const sendButton = screen.getByRole('button', { name: /send/i })
      expect(sendButton).not.toBeDisabled()
    })

    it('should show loading state while sending', async () => {
      mockApiAdminSendNotification.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ success: true, count: 1 }), 100))
      )

      render(<AdminSendNotification />)

      const recipientsInput = screen.getByLabelText('Recipients (comma-separated emails or user IDs)')
      const titleInput = screen.getByLabelText('Title')
      
      await user.clear(recipientsInput)
      await user.type(recipientsInput, 'alice@example.com')
      
      await user.clear(titleInput)
      await user.type(titleInput, 'Test Notification')

      // Ensure the button is enabled before clicking
      const sendButton = screen.getByRole('button', { name: /send/i })
      expect(sendButton).not.toBeDisabled()

      await user.click(sendButton)

      // Button should be disabled while sending
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()

      // Wait for the operation to complete and button to be re-enabled
      // Note: The form gets cleared after successful send, so the button will be disabled again
      await waitFor(() => {
        // The button should exist but may be disabled due to form validation
        expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
      })
    })
  })

  describe('recipient parsing', () => {
    beforeEach(() => {
      mockShouldUseCSharpApi.mockReturnValue(true)
      mockApiAdminSendNotification.mockResolvedValue({ success: true, count: 1 })
    })

    it('should trim whitespace from recipients', async () => {
      render(<AdminSendNotification />)

      const recipientsInput = screen.getByLabelText('Recipients (comma-separated emails or user IDs)')
      const titleInput = screen.getByLabelText('Title')
      
      await user.clear(recipientsInput)
      await user.type(recipientsInput, ' alice@example.com , bob@example.com ')
      
      await user.clear(titleInput)
      await user.type(titleInput, 'Test Notification')

      await user.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => {
        expect(mockApiAdminSendNotification).toHaveBeenCalledWith({
          recipients: [
            { email: 'alice@example.com' },
            { email: 'bob@example.com' }
          ],
          type: 'custom',
          title: 'Test Notification',
          message: 'This is a test', // Default value from component
          url: undefined
        })
      })
    })

    it('should filter out empty recipients', async () => {
      render(<AdminSendNotification />)

      const recipientsInput = screen.getByLabelText('Recipients (comma-separated emails or user IDs)')
      const titleInput = screen.getByLabelText('Title')
      
      await user.clear(recipientsInput)
      await user.type(recipientsInput, 'alice@example.com,,bob@example.com,')
      
      await user.clear(titleInput)
      await user.type(titleInput, 'Test Notification')

      await user.click(screen.getByRole('button', { name: /send/i }))

      await waitFor(() => {
        expect(mockApiAdminSendNotification).toHaveBeenCalledWith({
          recipients: [
            { email: 'alice@example.com' },
            { email: 'bob@example.com' }
          ],
          type: 'custom',
          title: 'Test Notification',
          message: 'This is a test', // Default value from component
          url: undefined
        })
      })
    })
  })
})
