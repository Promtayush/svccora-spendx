import { useState, useRef, useEffect } from "react";
import { NavLink, useLocation, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  CheckCircle,
  IndianRupee,
  Settings,
  Bell,
  Menu,
  ChevronDown,
  LogOut,
  Users,
  Sun,
  Moon,
  X,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/custom/Button";
import { Badge } from "@/components/custom/Badge";
import LanguageSwitcherPage from "../LanguageSwitcher.tsx";
import { useTranslation } from "react-i18next";
import { getFirstName, logout } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { useExpenses } from "@/hooks/useExpenses";
import { BRAND_NAME } from "@/lib/brand";

interface NavItem {
  titleKey: string;
  url: string;
  icon: any;
  badge?: number;
  label?: string;
}

const DashboardLayout = () => {
  const { t } = useTranslation("dashboardLayout");

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
  });

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role;
  const isApproverRole = userRole === "MANAGER" || userRole === "FINANCE" || userRole === "ADMIN";

  // Own expenses
  const { data: expenses = [] } = useExpenses({ scope: "mine" });

  // Approvals pending for privileged roles
  const { data: pendingApprovals = [] } = useExpenses({
    scope: "all",
    pendingApproval: true,
    enabled: isApproverRole,
  });

  const userName = user?.name || "";
  const roleName = userRole ? t(`roles.${userRole}`) : "";
  const roleColor = {
    EMPLOYEE: "bg-accent",
    MANAGER: "bg-warning",
    FINANCE: "bg-success",
    ADMIN: "bg-primary",
  }[userRole || ""] || "bg-accent";
  const firstName = getFirstName(user?.name);
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? t("greeting.morning") : hour < 18 ? t("greeting.afternoon") : t("greeting.evening");

  // Notifications logic
  const notifications = [
    ...(isApproverRole && pendingApprovals.length > 0
      ? [
          {
            id: "pending-approvals",
            title: `${pendingApprovals.length} Reports Awaiting Approval`,
            description: "Direct reports have submitted claims requiring your review.",
            link: "/approvals",
            type: "action",
          },
        ]
      : []),
    ...expenses
      .filter((e) => e.approvalStatus === "SENT_BACK" || e.status === "rejected")
      .map((e) => ({
        id: `sent-back-${e.id}`,
        title: `Claim #${e.id} Sent Back`,
        description: e.reviewComment ? `Note: "${e.reviewComment}"` : "Adjustment requested by reviewer.",
        link: "/claims",
        type: "warning",
      })),
    ...expenses
      .filter((e) => e.status === "APPROVED" && e.paymentStatus !== "PAID")
      .slice(0, 3)
      .map((e) => ({
        id: `approved-${e.id}`,
        title: `Claim #${e.id} Approved`,
        description: `₹${e.amount.toLocaleString("en-IN")} cleared for accounting settlement.`,
        link: "/claims",
        type: "success",
      })),
  ];

  // Outside click listeners
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const getNavItems = (): NavItem[] => {
    const baseItems = [
      { titleKey: "nav.dashboard", url: "/dashboard", icon: LayoutDashboard },
      { titleKey: "nav.myClaims", url: "/claims", icon: Receipt, badge: expenses.length },
    ];

    if (isApproverRole) {
      baseItems.push({
        titleKey: "nav.approvals",
        url: "/approvals",
        icon: CheckCircle,
        badge: pendingApprovals.length > 0 ? pendingApprovals.length : undefined,
      });
    }

    if (userRole === "FINANCE" || userRole === "ADMIN") {
      baseItems.push({
        titleKey: "nav.payments",
        url: "/payments",
        icon: IndianRupee,
      });
    }

    if (isApproverRole) {
      baseItems.push({
        titleKey: "",
        url: "/all-claims",
        icon: Receipt,
        label: t("nav.allClaims"),
      });
    }

    if (userRole === "ADMIN") {
      baseItems.push({
        titleKey: "",
        url: "/admin/users",
        icon: Users,
        label: t("nav.users"),
      });
    }

    baseItems.push({ titleKey: "nav.settings", url: "/settings", icon: Settings });
    return baseItems;
  };

  const navItems = getNavItems();
  const isActive = (path: string) => location.pathname === path;

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Desktop and Mobile Drawer) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col overflow-x-hidden bg-card border-r border-border transition-all duration-300 ${
          isSidebarOpen ? "w-64 translate-x-0" : "-translate-x-full md:translate-x-0 md:w-16"
        }`}
      >
        {/* Logo & Brand */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5 text-primary-foreground" />
            </div>
            {isSidebarOpen && (
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {BRAND_NAME}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {t("logoSubtitle")}
                </p>
              </div>
            )}
          </div>
          {/* Close button on mobile */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Role */}
        {isSidebarOpen && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
              <div className={`w-2 h-2 rounded-full ${roleColor}`} />
              <span className="text-sm">{t("roleSelector")}: {roleName}</span>
            </div>
          </div>
        )}

        {/* Language Selector */}
        <LanguageSwitcherPage collapsed={!isSidebarOpen} />

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.url}>
                  <NavLink
                    to={item.url}
                    onClick={closeSidebarOnMobile}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-smooth ${
                      isActive(item.url)
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {isSidebarOpen && (
                      <>
                        <span className="text-sm">
                          {item.label || t(item.titleKey)}
                        </span>
                        {item.badge !== undefined && (
                          <Badge
                            variant={item.url === "/approvals" ? "default" : "secondary"}
                            className={`ml-auto text-xs ${item.url === "/approvals" ? "bg-primary text-primary-foreground font-bold" : ""}`}
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </Button>

            <div>
              <h2 className="text-base sm:text-lg font-semibold truncate tracking-tight text-foreground">
                {firstName ? firstName : "Executive Overview"}
              </h2>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {roleName} · {BRAND_NAME}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle (Light / Dark Mode) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="text-muted-foreground hover:text-foreground"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </Button>

            {/* Notification Bell Dropdown */}
            <div className="relative" ref={notificationsRef}>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                title="View Notifications"
              >
                <Bell className="w-5 h-5 text-muted-foreground" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                  </span>
                )}
              </Button>

              {isNotificationsOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card p-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">Notifications</h4>
                      <Badge variant="secondary" className="text-xs">
                        {notifications.length}
                      </Badge>
                    </div>
                    {notifications.length > 0 && (
                      <span className="text-[11px] text-muted-foreground">Action required</span>
                    )}
                  </div>

                  <div className="mt-2 space-y-2 max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground text-xs">
                        <CheckCircle className="w-6 h-6 mx-auto mb-1 text-success opacity-80" />
                        All caught up! No pending notifications.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            navigate(notif.link);
                          }}
                          className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer border border-transparent hover:border-border"
                        >
                          {notif.type === "action" ? (
                            <Clock className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                          ) : notif.type === "warning" ? (
                            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {notif.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                              {notif.description}
                            </p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-2"
                onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
                aria-expanded={isProfileOpen}
              >
                <div className="w-8 h-8 bg-muted border border-border rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-foreground">
                    {userName ? userName.charAt(0).toUpperCase() : "U"}
                  </span>
                </div>
                <span className="text-sm hidden sm:inline max-w-[120px] truncate">{userName}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>

              {isProfileOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-xl">
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="text-sm font-semibold truncate text-foreground">{userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                        {roleName}
                      </Badge>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate("/settings");
                    }}
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Account Settings
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => {
                      logout();
                      navigate("/auth", { replace: true });
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    {t("logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
