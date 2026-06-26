export interface ApiResponse<T> {
  success: true
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  success: true
  data: T[]
  pagination: Pagination
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiError {
  success: false
  message: string
  errors?: Record<string, string[]>
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}
