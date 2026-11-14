import { useCallback, useEffect, useState } from 'react';
import type { OaizAuth, OaizError, OaizUser } from '@oaiz/sdk';

export type OaizSessionStatus = 'loading' | 'signed-out' | 'signed-in';

export type OaizSessionState = {
  status: OaizSessionStatus;
  /** The signed-in member; `null` unless `status` is `signed-in`. */
  user: OaizUser | null;
  /** The last sign-in, session or sign-out failure. */
  error: OaizError | null;
  /** Sends the browser to OAIZ; the page loads again, signed in. */
  signIn: () => Promise<void>;
  /** Ends the session. It signs out in this browser even when OAIZ answers with an error. */
  signOut: () => Promise<void>;
};

/** The member signed in to this app through `auth` (`client.auth` of the app's `@oaiz/sdk` client). */
export function useOaizSession(auth: OaizAuth): OaizSessionState {
  const [status, setStatus] = useState<OaizSessionStatus>('loading');
  const [user, setUser] = useState<OaizUser | null>(null);
  const [error, setError] = useState<OaizError | null>(null);

  useEffect(() => {
    let current = true;
    void (async () => {
      const session = await auth.getSession();
      if (!current) return;
      if (session.error) setError(session.error);
      if (!session.data) {
        setStatus('signed-out');
        return;
      }
      const member = await auth.getUser();
      if (!current) return;
      if (member.error) {
        setError(member.error);
        setStatus('signed-out');
        return;
      }
      setUser(member.data);
      setStatus('signed-in');
    })();
    return () => {
      current = false;
    };
  }, [auth]);

  const signIn = useCallback(async () => {
    setError(null);
    const answer = await auth.signIn();
    if (answer.error) setError(answer.error);
  }, [auth]);

  const signOut = useCallback(async () => {
    const answer = await auth.signOut();
    setError(answer.error);
    setUser(null);
    setStatus('signed-out');
  }, [auth]);

  return { status, user, error, signIn, signOut };
}
