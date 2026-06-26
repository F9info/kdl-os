import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/axios'

export function useAuth() {
  const { user, isAuthenticated, isLoading, clearAuth } = useAuthStore()
  const router = useRouter()

  const { mutate: logout, isPending: isLoggingOut } = useMutation({
    mutationFn: async () => {
      // Refresh token is in an httpOnly cookie — backend reads and revokes it
      await api.post('/auth/logout', {})
    },
    onSettled: () => {
      clearAuth()
      router.push('/login')
    },
  })

  return {
    user,
    isAuthenticated,
    isLoading,
    isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    logout,
    isLoggingOut,
  }
}
