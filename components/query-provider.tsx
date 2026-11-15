"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Data hydrated from the server is fresh for a minute; avoids an immediate refetch on mount.
      queries: { staleTime: 60_000, refetchOnWindowFocus: false },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  // Isolate each server render; keep one cache for the life of the browser tab.
  if (typeof window === "undefined") return makeQueryClient()
  return (browserQueryClient ??= makeQueryClient())
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
      <ReactQueryDevtools buttonPosition="bottom-right" />
    </QueryClientProvider>
  )
}
