"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"

import type { TeamUser } from "@/lib/users"

export const USERS_KEY = ["users"] as const

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

async function fetchUsers(org: string): Promise<TeamUser[]> {
  const response = await fetch(`/api/o/${encodeURIComponent(org)}/members`, {
    cache: "no-store",
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new HttpError(body.error ?? "Couldn’t load users.", response.status)
  return body
}

export function useUsers(org: string, enabled = true) {
  return useQuery({
    queryKey: [...USERS_KEY, org],
    queryFn: () => fetchUsers(org),
    enabled,
    staleTime: 15_000,
    // A 401/403 won't fix itself by retrying.
    retry: (count, error) =>
      !(error instanceof HttpError && error.status < 500) && count < 2,
  })
}

/** Run a server action; on success refresh the list. Returns the result for the caller to toast. */
export function useUsersMutation() {
  const queryClient = useQueryClient()
  return async <T extends { ok: boolean }>(action: () => Promise<T>) => {
    const result = await action().catch(
      () =>
        ({
          ok: false,
          error: "That didn’t save. Check your connection and try again.",
        }) as unknown as T
    )
    if (result.ok) await queryClient.invalidateQueries({ queryKey: USERS_KEY })
    return result
  }
}
