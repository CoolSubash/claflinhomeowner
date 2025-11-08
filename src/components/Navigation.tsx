import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Menu } from "lucide-react";
import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import safePlaceLogo from "@/assets/safeplace-logo.png";
import { useAuth } from "@/context/AuthContext";
import defaultAvatar from "@/assets/user.png";
import homeReadyLogo from "@/assets/homeready-logo.png";
const ALL_ITEMS = [
  { title: "Dashboard", path: "/dashboard", authOnly: true },
  { title: "First Steps", path: "/first-steps" },
  { title: "Financial Readiness", path: "/financial-readiness" },
  { title: "Resources and Assistance", path: "/resources" },
  { title: "Knowledge Center", path: "/knowledge-center" },
  { title: "About Us", path: "/about" },
] as const;

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  console.log(user);

  // Only include Dashboard when authenticated
  const navItems = useMemo(
    () => ALL_ITEMS.filter((i) => !i.authOnly || !!user),
    [user]
  );

  const initial =
    user?.displayName?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "U";

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo → Welcome */}
          <Link to="/" className="flex shrink-0 items-center gap-2">
  <img
    src={homeReadyLogo}
    alt="HomeReady"
    className="h-12 md:h-14 w-auto object-contain"
  />
</Link>


          {/* Desktop nav */}
          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList>
              {navItems.map((item) => (
                <NavigationMenuItem key={item.path}>
                  <Link to={item.path}>
                    <NavigationMenuLink
                      className={[
                        navigationMenuTriggerStyle(),
                        isActive(item.path) ? "bg-primary/10 text-primary" : "",
                      ].join(" ")}
                      aria-current={isActive(item.path) ? "page" : undefined}
                    >
                      {item.title}
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          {/* Right side: auth actions or avatar */}
          <div className="hidden items-center gap-3 lg:flex">
            {!user ? (
              <>
                <Link to="/login">
                  <Button variant="outline">Log in</Button>
                </Link>
                <Link to="/signup">
                  <Button>Sign up</Button>
                </Link>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary font-semibold overflow-hidden"
                    aria-label="User menu"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="avatar"
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <img
                        src={defaultAvatar}
                        alt="default avatar"
                        className="h-9 w-9 rounded-full object-cover opacity-80"
                      />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">
                    {user.displayName || user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive focus:text-destructive"
                  >
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Mobile hamburger + sheet */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <nav className="mt-8 flex flex-col gap-3">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                      isActive(item.path)
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted"
                    }`}
                    aria-current={isActive(item.path) ? "page" : undefined}
                  >
                    {item.title}
                  </Link>
                ))}

                <div className="my-2 h-px bg-border" />

                {!user ? (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-lg bg-muted/60 px-4 py-3 text-base font-medium transition hover:bg-muted"
                    >
                      Log in
                    </Link>
                    <Link
                      to="/signup"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-lg bg-primary px-4 py-3 text-base font-medium text-primary-foreground"
                    >
                      Sign up
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="px-4 py-2 text-sm text-muted-foreground">
                      {user.displayName || user.email}
                    </div>
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="rounded-lg bg-destructive/90 px-4 py-3 text-left text-base font-medium text-destructive-foreground"
                    >
                      Log out
                    </button>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
