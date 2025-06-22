export type DatabaseConfig = {
   tableName: string
   isStreamEnabled: boolean
}

export type SearchParams = {
   query?: {
      match?: Record<string, any> // For full-text search
      term?: Record<string, any> // For exact matches
      range?: Record<string, any> // For range queries
      bool?: {
         // For complex boolean queries
         must?: any[] // All must match
         should?: any[] // At least one should match
         must_not?: any[] // Must not match
         filter?: any[] // Filter context
      }
   }
   sort?: Array<Record<string, { order: 'asc' | 'desc' }>> // Sorting options
   from?: number // Pagination start
   size?: number // Number of results per page
}

// New type for SQL queries
export type SqlQueryParams = {
   sql: string // The SQL query string
   format?: 'json' | 'csv' | 'raw' // Response format
   fetch_size?: number // Number of results to return
   filter_path?: string[] // Fields to include in response
}
