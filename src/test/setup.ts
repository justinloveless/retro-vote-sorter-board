import '@testing-library/jest-dom'

// Mock global fetch
global.fetch = vi.fn()

// Mock environment variables
vi.mock('import.meta.env', () => ({
  VITE_USE_CSHARP_API: 'true',
  VITE_API_BASE_URL: 'http://localhost:5227',
}))

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              then: vi.fn()
            }))
          }))
        }))
      }))
    })),
    functions: {
      invoke: vi.fn()
    }
  }
}))
