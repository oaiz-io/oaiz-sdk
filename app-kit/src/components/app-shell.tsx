import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Menu, Search } from 'lucide-react';

import { useTheme, type ThemeChoice } from '../hooks/use-theme';
import { cn } from '../lib/utils';
import {
  CommandPalette,
  useHotkey,
  type CommandPaletteGroup,
} from './command-palette';
import { Avatar, AvatarFallback } from './ui/avatar';
import { BottomNavigation, BottomNavigationItem } from './ui/bottom-navigation';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Heading } from './ui/heading';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { Text } from './ui/text';

export type AppShellNavItem = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  /** A number after the label, such as open items. */
  count?: number;
  active?: boolean;
  /** A link target; without it the item is a button that calls `onSelect`. */
  href?: string;
  onSelect?: () => void;
};

export type AppShellNavSection = {
  key: string;
  /** A small heading above the section's items. */
  label?: ReactNode;
  items: AppShellNavItem[];
};

export type AppShellUser = { name?: string; email?: string };

export type AppShellMessages = {
  skipToContent: string;
  sidebar: string;
  main: string;
  navigation: string;
  navigationDescription: string;
  openNavigation: string;
  search: string;
  goTo: string;
  account: string;
  theme: string;
  light: string;
  dark: string;
  system: string;
  signOut: string;
};
const SHELL_MESSAGES: AppShellMessages = {
  skipToContent: 'Skip to main content',
  sidebar: 'Sidebar',
  main: 'Main',
  navigation: 'Navigation',
  navigationDescription: "The app's pages",
  openNavigation: 'Open navigation',
  search: 'Search',
  goTo: 'Go to',
  account: 'Account',
  theme: 'Theme',
  light: 'Light',
  dark: 'Dark',
  system: 'Match system',
  signOut: 'Sign out',
};

export type AppShellProps = {
  appName: ReactNode;
  logo?: ReactNode;
  nav: AppShellNavSection[];
  /** The page title in the header. */
  title?: ReactNode;
  /** Buttons at the right of the header. */
  actions?: ReactNode;
  /** `narrow` holds the bar and the page to one centred column, for a short table, a feed or a form. */
  width?: 'full' | 'narrow';
  user?: AppShellUser;
  /** More user menu items, above Sign out. */
  userMenu?: ReactNode;
  onSignOut?: () => unknown;
  /**
   * The app's actions and records. The shell mounts the command palette with them and with a Go to
   * group of the nav items, opens it with ⌘K and shows the search button.
   */
  commands?: CommandPaletteGroup[];
  /** Reports the palette's search text, so the caller can read matching records from OAIZ. */
  onCommandSearch?: (search: string) => void;
  /** A search button that shows ⌘K for a palette the app holds itself; `commands` replaces it. */
  onSearch?: () => void;
  /** Sets the page in a rounded panel beside the sidebar, as in Linear. */
  inset?: boolean;
  /** Uses the sidebar primary/foreground pair for a contrasting navigation surface. */
  sidebarAppearance?: 'default' | 'inverted';
  /**
   * How a phone or narrow window reaches the nav: `menu` opens it from a button in the header;
   * `tabs` shows up to five nav items as a tab bar at the bottom, within reach of the thumb, and
   * the menu only when there are more.
   */
  phoneNav?: 'menu' | 'tabs';
  children: ReactNode;
  messages?: Partial<AppShellMessages>;
  /** Stable main target for consumer-owned route focus. The app owns document.title. */
  mainId?: string;
};

const INVERTED_SIDEBAR = {
  '--role-sidebar': 'var(--role-sidebar-primary)',
  '--role-sidebar-foreground': 'var(--role-sidebar-primary-foreground)',
  '--role-sidebar-accent':
    'color-mix(in oklch, var(--role-sidebar-primary-foreground) 14%, var(--role-sidebar-primary))',
  '--role-sidebar-accent-foreground': 'var(--role-sidebar-primary-foreground)',
  '--role-sidebar-selected':
    'color-mix(in oklch, var(--role-sidebar-primary-foreground) 22%, var(--role-sidebar-primary))',
  '--role-sidebar-border':
    'color-mix(in oklch, var(--role-sidebar-primary-foreground) 25%, var(--role-sidebar-primary))',
  '--role-sidebar-ring': 'var(--role-sidebar-primary-foreground)',
} as CSSProperties;

function initials(user: AppShellUser): string {
  const source = user.name || user.email || '';
  const words = source.split(/[\s@.]+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('') || '?'
  );
}

function NavList({
  nav,
  onNavigate,
}: {
  nav: AppShellNavSection[];
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-stack">
      {nav.map((section) => (
        <div key={section.key} className="flex flex-col gap-1">
          {section.label && (
            <Text
              size="xs"
              variant="inherit"
              weight="medium"
              className="px-inline"
            >
              {section.label}
            </Text>
          )}
          <ul className="flex flex-col gap-1">
            {section.items.map((item) => {
              const className = cn(
                'flex w-full items-center gap-inline rounded-md px-inline py-1.5 text-left max-mobile:py-inset text-sm text-sidebar-foreground transition-colors duration-fast ease-move hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset focus-visible:ring-offset-0',
                item.active &&
                  'bg-sidebar-selected font-medium text-sidebar-accent-foreground',
              );
              const content = (
                <>
                  {item.icon && (
                    <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
                      {item.icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.count !== undefined && (
                    <Text
                      as="span"
                      size="xs"
                      className="tabular-nums"
                      variant="inherit"
                    >
                      {item.count}
                    </Text>
                  )}
                </>
              );
              const select = () => {
                item.onSelect?.();
                onNavigate?.();
              };
              return (
                <li key={item.key}>
                  {item.href !== undefined ? (
                    <a
                      href={item.href}
                      aria-current={item.active ? 'page' : undefined}
                      className={className}
                      onClick={select}
                    >
                      {content}
                    </a>
                  ) : (
                    <Button variant="plain" size={null}
                      type="button"
                      aria-current={item.active ? 'page' : undefined}
                      className={className}
                      onClick={select}
                    >
                      {content}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** With `iconOnPhone`, a phone shows the search icon alone, so a narrow header keeps room for its title. */
function SearchButton({
  onSearch,
  iconOnPhone = false,
  label,
  className,
}: {
  onSearch: () => void;
  iconOnPhone?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <Button variant="plain" size={null}
      type="button"
      onClick={onSearch}
      className={cn(
        'flex h-8 items-center gap-inline rounded-md border bg-background px-inline text-sm text-muted-foreground shadow-xs transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        iconOnPhone &&
          'max-mobile:w-8 max-mobile:justify-center max-mobile:px-0',
        className,
      )}
    >
      <Search aria-hidden="true" className="size-3.5" />
      <span className={cn(iconOnPhone && 'max-mobile:sr-only')}>{label}</span>
      <kbd
        className={cn(
          'ml-auto font-sans text-xs',
          iconOnPhone && 'max-mobile:hidden',
        )}
      >
        ⌘K
      </kbd>
    </Button>
  );
}

function navCommands(
  nav: AppShellNavSection[],
  heading: string,
): CommandPaletteGroup {
  return {
    heading,
    items: nav
      .flatMap((section) => section.items)
      .flatMap((item) =>
        typeof item.label === 'string'
          ? [
              {
                id: `nav:${item.key}`,
                label: item.label,
                icon: item.icon,
                onSelect: () => {
                  item.onSelect?.();
                  if (item.href !== undefined)
                    window.location.assign(item.href);
                },
              },
            ]
          : [],
      ),
  };
}

function Brand({
  appName,
  logo,
  onSearch,
  searchLabel,
}: {
  appName: ReactNode;
  logo?: ReactNode;
  onSearch?: () => void;
  searchLabel: string;
}) {
  return (
    <div className="flex flex-col gap-inline">
      <div className="flex h-10 items-center gap-inline px-inline">
        {logo}
        <Text size="sm" weight="semibold" variant="inherit" className="truncate">
          {appName}
        </Text>
      </div>
      {onSearch && (
        <SearchButton
          onSearch={onSearch}
          label={searchLabel}
          className="border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring focus-visible:ring-offset-sidebar"
        />
      )}
    </div>
  );
}

/**
 * The frame of an app: a sidebar with the app name and sections of navigation, and a header with
 * the page title, actions and the user menu. Below the `half` breakpoint the sidebar opens as a
 * sheet from a header button. With fewer than two nav items there is nothing to navigate: the app
 * name moves to the header and no sidebar is drawn.
 */
export function AppShell({
  appName,
  logo,
  nav,
  title,
  actions,
  width = 'full',
  user,
  userMenu,
  onSignOut,
  commands,
  onCommandSearch,
  onSearch,
  inset = false,
  sidebarAppearance = 'default',
  phoneNav = 'menu',
  children,
  messages: overrides,
  mainId,
}: AppShellProps) {
  const sidebarStyle =
    sidebarAppearance === 'inverted' ? INVERTED_SIDEBAR : undefined;
  const messages = { ...SHELL_MESSAGES, ...overrides };
  const generatedMainId = useId();
  const contentId = mainId ?? generatedMainId;
  const mainRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const theme = useTheme();
  const navItems = nav.flatMap((section) => section.items);
  const hasSidebar = navItems.length > 1;
  const tabs = phoneNav === 'tabs' && hasSidebar && navItems.length <= 5;
  const search = commands ? () => setPaletteOpen(true) : onSearch;
  useHotkey('k', () => setPaletteOpen((open) => !open), {
    mod: true,
    enabled: commands !== undefined,
  });

  return (
    <div
      className={cn(
        'flex h-svh text-foreground',
        inset
          ? sidebarAppearance === 'inverted' ? 'bg-sidebar-primary' : 'bg-sidebar'
          : 'bg-background',
      )}
    >
      <a
        href={`#${contentId}`}
        onClick={() => mainRef.current?.focus()}
        className="sr-only z-50 rounded-md bg-background p-inline text-foreground shadow-md focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:ring-2 focus:ring-ring"
      >
        {messages.skipToContent}
      </a>
      {commands && (
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          groups={[...commands, navCommands(nav, messages.goTo)]}
          onSearchChange={onCommandSearch}
        />
      )}
      {hasSidebar && (
        <aside
          aria-label={messages.sidebar}
          style={sidebarStyle}
          className={cn(
            'hidden w-sidebar shrink-0 flex-col gap-stack border-sidebar-border bg-sidebar p-inline text-sidebar-foreground half:flex',
            !inset && 'border-r',
          )}
        >
          <Brand
            appName={appName}
            logo={logo}
            onSearch={search}
            searchLabel={messages.search}
          />
          <nav
            aria-label={messages.main}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <NavList nav={nav} />
          </nav>
        </aside>
      )}
      <Sheet open={hasSidebar && navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="left"
          style={sidebarStyle}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            menuRef.current?.focus();
          }}
          className="w-sidebar border-sidebar-border bg-sidebar p-inline text-sidebar-foreground [&>button]:ring-offset-sidebar [&>button]:focus:ring-sidebar-ring [&>button[data-state=open]]:bg-sidebar-accent"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{messages.navigation}</SheetTitle>
            <SheetDescription>
              {messages.navigationDescription}
            </SheetDescription>
          </SheetHeader>
          <Brand
            appName={appName}
            searchLabel={messages.search}
            logo={logo}
            onSearch={
              search &&
              (() => {
                setNavOpen(false);
                search();
              })
            }
          />
          <nav aria-label={messages.main}>
            <NavList nav={nav} onNavigate={() => setNavOpen(false)} />
          </nav>
        </SheetContent>
      </Sheet>
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col bg-background',
          inset &&
            'half:my-inline half:mr-inline half:overflow-hidden half:rounded-lg half:border half:shadow-xs',
        )}
      >
        <header
          className={cn(
            'flex h-11 shrink-0 items-center gap-inline border-b',
            width === 'narrow'
              ? 'px-[max(var(--spacing-page),calc((100%-48rem)/2))]'
              : 'px-page',
          )}
        >
          {hasSidebar && !tabs && (
            <Button
              variant="ghost"
              size="icon"
              className="half:hidden"
              ref={menuRef}
              aria-label={messages.openNavigation}
              onClick={() => setNavOpen(true)}
            >
              <Menu />
            </Button>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-inline">
            {!hasSidebar && logo}
            {!hasSidebar &&
              (title ? (
                <>
                  <Text
                    size="sm"
                    variant="muted"
                    className="truncate max-mobile:hidden"
                  >
                    {appName}
                  </Text>
                  <span
                    aria-hidden="true"
                    className="text-sm text-muted-foreground max-mobile:hidden"
                  >
                    /
                  </span>
                </>
              ) : (
                <Heading
                  level={1}
                  size="md"
                  weight="semibold"
                  className="truncate"
                >
                  {appName}
                </Heading>
              ))}
            {title && (
              <Heading
                level={1}
                size="md"
                weight="semibold"
                className="truncate"
              >
                {title}
              </Heading>
            )}
          </div>
          {!hasSidebar && search && (
            <SearchButton
              onSearch={search}
              label={messages.search}
              iconOnPhone
              className="w-40"
            />
          )}
          {actions && (
            <div className="flex items-center gap-inline">{actions}</div>
          )}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  shape="pill"
                  aria-label={messages.account}
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">
                      {initials(user)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuLabel className="flex flex-col">
                  {user.name && <span>{user.name}</span>}
                  {user.email && (
                    <span className="font-normal text-muted-foreground">
                      {user.email}
                    </span>
                  )}
                </DropdownMenuLabel>
                {userMenu}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{messages.theme}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={theme.choice}
                  onValueChange={(value) =>
                    theme.setChoice(value as ThemeChoice)
                  }
                >
                  <DropdownMenuRadioItem value="light">
                    {messages.light}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    {messages.dark}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    {messages.system}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                {onSignOut && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void onSignOut()}>
                      {messages.signOut}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        <main
          id={contentId}
          ref={mainRef}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto outline-none"
        >
          {width === 'narrow' ? (
            <div className="mx-auto h-full max-w-[calc(48rem+2*var(--layout-page-gutter))] p-[var(--layout-page-gutter)] [--spacing-page:0px]">
              {children}
            </div>
          ) : (
            children
          )}
        </main>
        {tabs && (
          <BottomNavigation aria-label={messages.main} className="half:hidden">
            {navItems.map((item) => (
              <BottomNavigationItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                selected={item.active}
                aria-current={item.active ? 'page' : undefined}
                badge={item.count}
                asChild={item.href !== undefined}
                onClick={item.href === undefined ? item.onSelect : undefined}
              >
                {item.href !== undefined ? <a href={item.href} /> : undefined}
              </BottomNavigationItem>
            ))}
          </BottomNavigation>
        )}
      </div>
    </div>
  );
}
