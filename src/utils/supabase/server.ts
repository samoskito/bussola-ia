import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieOptions = {
  name: string
  value: string
  domain?: string
  path?: string
  maxAge?: number
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
}

export function createClient() {
  const cookieStore = cookies()
  
  // In Next.js 13+, the cookies() function returns a ReadonlyRequestCookies object
  // that doesn't have a get() method. We'll use a different approach.
  const getCookie = (name: string) => {
    try {
      // @ts-ignore - The cookies() function returns a ReadonlyRequestCookies object
      // that has a get() method in the runtime
      return cookieStore.get(name)?.value
    } catch (error) {
      console.error('Error getting cookie:', error)
      return undefined
    }
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => getCookie(name),
        set: (name: string, value: string, options: CookieOptions) => {
          try {
            // In Next.js 13+, cookies are set via the response headers
            // This will be handled by the middleware
            return
          } catch (error) {
            console.error('Error setting cookie:', error)
          }
        },
        remove: (name: string, options: Omit<CookieOptions, 'name' | 'value'>) => {
          try {
            // In Next.js 13+, cookies are removed via the response headers
            // This will be handled by the middleware
            return
          } catch (error) {
            console.error('Error removing cookie:', error)
          }
        },
      },
    }
  )
}

// Helper function to create a route handler client
export function createRouteHandlerClient() {
  return createClient()
}

// Function to get the user session on the server
export async function getServerSession() {
  const supabase = createClient()
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

// Function to get the current user on the server
export async function getCurrentUser() {
  const supabase = createClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}
