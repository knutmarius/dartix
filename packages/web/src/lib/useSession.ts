import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

/**
 * Who you are signed in as.
 *
 * The same query the auth gate runs, so this is a cache read rather than a
 * request. Defaults to read-only while it is in flight: showing a Save button
 * that then 403s is worse than showing it a moment late.
 *
 * Everything this drives is presentation. The passcode boundary itself is
 * `requireWrite` in the API — a read-only session with devtools open still
 * has to get past that.
 */
export function useSession() {
  const session = useQuery({
    queryKey: ['session'],
    queryFn: api.session,
    staleTime: Infinity,
    retry: false,
  });

  return {
    role: session.data?.role ?? null,
    canWrite: session.data?.role === 'full',
    readOnly: session.data?.role === 'readonly',
  };
}
