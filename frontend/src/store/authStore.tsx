import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  refreshAccessToken,
  getAuthToken,
  setAuthToken,
  validateToken,
} from "../services/api"

interface User {
  id: number
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  is_active: boolean
  is_verified: boolean
  role: string
  permissions: string[]
}

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  loginStatus: "idle" | "loading" | "authenticated" | "unauthenticated"
  login: (email: string, password: string) => Promise<User>
  register: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    phone?: string
  ) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loginStatus, setLoginStatus] = useState<"idle" | "loading" | "authenticated" | "unauthenticated">("idle")

  useEffect(() => {
    let cancelled = false

    const restoreSession = async () => {
      const token = getAuthToken()

      if (!token) {
        setIsLoading(false)
        setLoginStatus("unauthenticated")
        return
      }

      let validatedUser = await validateToken()

      if (!validatedUser) {
        try {
          await refreshAccessToken()
          validatedUser = await validateToken()
        } catch {
          // Refresh failed — session is dead.
        }
      }

      if (cancelled) return

      if (validatedUser) {
        setAuthToken(getAuthToken())
        setUser(validatedUser)
        setLoginStatus("authenticated")
      } else {
        setAuthToken(null)
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
        localStorage.removeItem("user_email")
        setLoginStatus("unauthenticated")
      }

      setIsLoading(false)
    }

    restoreSession()

    const handleUnauthenticated = () => {
      setUser(null)
      setLoginStatus("unauthenticated")
    }
    window.addEventListener("auth:unauthenticated", handleUnauthenticated)

    return () => {
      cancelled = true
      window.removeEventListener("auth:unauthenticated", handleUnauthenticated)
    }
  }, [])

  const login = async (email: string, password: string): Promise<User> => {
    setLoginStatus("loading")
    try {
      const userData = await apiLogin(email, password)
      setUser(userData)
      setLoginStatus("authenticated")
      return userData
    } catch (error: any) {
      setLoginStatus("unauthenticated")
      throw error
    }
  }

  const register = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    phone?: string
  ) => {
    setLoginStatus("loading")
    try {
      const userData = await apiRegister(email, password, firstName, lastName, phone)
      setUser(userData)
      setLoginStatus("authenticated")
    } catch (error: any) {
      setLoginStatus("unauthenticated")
      throw error
    }
  }

  const logout = async () => {
    try {
      await apiLogout()
    } finally {
      setUser(null)
      setLoginStatus("unauthenticated")
    }
  }

  const refreshToken = async () => {
    try {
      await refreshAccessToken()
      const validatedUser = await validateToken()
      if (validatedUser) {
        setUser(validatedUser)
      }
    } catch (error) {
      logout()
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, loginStatus, login, register, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}