import { useEffect, useState, type ReactNode } from 'react';
import type { OaizAuth, OaizUser } from '@oaiz/sdk';

import { useOaizSession } from '../hooks/oaiz-session';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Heading } from './ui/heading';
import { Skeleton } from './ui/skeleton';
import { Text } from './ui/text';

export type SignInScreenProps = {
  title?: ReactNode;
  /** Use a div when this screen is embedded inside an existing page landmark. */
  as?: 'main' | 'div';
  errorTitle?: ReactNode;
  description?: ReactNode;
  /** Shown above the title, for example the app's logo. */
  logo?: ReactNode;
  signInLabel?: ReactNode;
  onSignIn: () => unknown;
  loading?: boolean;
  error?: { message: string } | null;
  /** Small text under the card. */
  footer?: ReactNode;
};

/** A centred sign-in card with its loading and error states. */
export function SignInScreen({
  title = 'Welcome',
  as: Container = 'main',
  errorTitle = 'Something went wrong',
  description = 'Sign in with your OAIZ account to continue.',
  logo,
  signInLabel = 'Sign in with OAIZ',
  onSignIn,
  loading = false,
  error,
  footer,
}: SignInScreenProps) {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    try {
      await onSignIn();
    } finally {
      setPending(false);
    }
  }

  return (
    <Container
      aria-busy={loading}
      className="flex min-h-svh flex-col items-center justify-center gap-stack bg-muted p-page"
    >
      <section className="flex w-full max-w-sm flex-col gap-section rounded-lg border bg-card p-section text-card-foreground shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center gap-stack">
            <Skeleton className="size-12 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-stack text-center">
              {logo}
              <div className="flex flex-col gap-1">
                <Heading level={1} size="2xl">
                  {title}
                </Heading>
                <Text variant="muted">{description}</Text>
              </div>
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={pending}
              onClick={() => void signIn()}
            >
              {signInLabel}
            </Button>
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTitle level={2}>{errorTitle}</AlertTitle>
            <AlertDescription className="break-words">
              {error.message}
            </AlertDescription>
          </Alert>
        )}
      </section>
      {footer && (
        <Text size="xs" variant="muted">
          {footer}
        </Text>
      )}
    </Container>
  );
}

export type SessionGateProps = Omit<
  SignInScreenProps,
  'onSignIn' | 'loading' | 'error'
> & {
  /** `client.auth` of the app's `@oaiz/sdk` client. */
  auth: OaizAuth;
  /**
   * Signs the member in without a click, once, while the page is framed.
   * OAIZ frames only an app's canvas preview, where the member is already
   * signed in to OAIZ. Pass `false` to always show the sign-in screen.
   */
  autoSignIn?: boolean;
  /** The app, for a signed-in member. */
  children: (session: {
    user: OaizUser;
    signOut: () => Promise<void>;
  }) => ReactNode;
};

const AUTO_SIGN_IN_KEY = 'oaiz.autoSignIn';

function isFramed() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Shows the sign-in screen until a member is signed in, then the app. In a
 * frame it starts the sign-in itself, once per tab: the mark it leaves stops a
 * refused sign-in or a sign-out from starting another until the member is
 * signed in again.
 */
export function SessionGate({
  auth,
  children,
  autoSignIn = isFramed(),
  ...screen
}: SessionGateProps) {
  const session = useOaizSession(auth);
  const { status, signIn } = session;
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!autoSignIn) return;
    if (status === 'signed-in') {
      sessionStorage.removeItem(AUTO_SIGN_IN_KEY);
      return;
    }
    if (status !== 'signed-out' || sessionStorage.getItem(AUTO_SIGN_IN_KEY)) {
      return;
    }
    sessionStorage.setItem(AUTO_SIGN_IN_KEY, '1');
    setStarting(true);
    void signIn();
  }, [autoSignIn, status, signIn]);

  if (status === 'signed-in' && session.user) {
    return children({
      user: session.user,
      signOut: async () => {
        sessionStorage.setItem(AUTO_SIGN_IN_KEY, '1');
        await session.signOut();
      },
    });
  }
  return (
    <SignInScreen
      {...screen}
      loading={status === 'loading' || (starting && !session.error)}
      error={session.error}
      onSignIn={signIn}
    />
  );
}
