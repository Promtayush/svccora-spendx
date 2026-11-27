import { useMemo } from "react";
import { Plus, TrendingUp, Clock, CheckCircle, IndianRupee, Receipt, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/custom/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/custom/Card";
import ClaimCard, { Claim } from "@/components/claims/ClaimCard";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trans } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useExpenses } from "@/hooks/useExpenses";

const Dashboard = () => {
  const { t, i18n } = useTranslation("dashboard");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: expenses = [], isLoading, isError, error, refetch } = useExpenses({
    scope: "mine",
  });
  const isPrivileged = user?.role === "MANAGER" || user?.role === "FINANCE" || user?.role === "ADMIN";
  const {
    data: teamExpenses = [],
    isLoading: isTeamLoading,
    isError: isTeamError,
    error: teamError,
    refetch: refetchTeam,
  } = useExpenses({
    scope: "all",
    enabled: isPrivileged,
  });
  const roleName = user?.role ? t(`roles.${user.role}`) : "";
  const claims = useMemo<Claim[]>(
    () =>
      expenses.map((expense) => ({
        id: String(expense.id),
        title: expense.category,
        amount: expense.amount,
        description: expense.description,
        date: expense.date,
        status: expense.status.toLowerCase(),
        category: expense.category,
        submittedBy: expense.user.name || expense.user.email,
        submittedById: expense.userId,
        reviewComment: expense.reviewComment,
        approvalStatus: expense.approvalStatus,
        paymentStatus: expense.paymentStatus,
        currentStep: expense.currentStep,
        receiptUrl: expense.receiptUrl,
        costCenterCode: expense.costCenterCode,
        paymentReference: expense.paymentReference,
        rawExpense: expense,
      })),
    [expenses]
  );
  const totalPending = expenses.filter((expense) => expense.status.toUpperCase() === "PENDING").length;
  const totalApproved = expenses.filter((expense) => expense.status.toUpperCase() === "APPROVED").length;
  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const recentClaims = [...claims]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);
  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  });

  const stats = [
    {
      title: t("stats.totalClaims"),
      value: claims.length.toString(),
      icon: TrendingUp,
      color: "text-muted-foreground",
      link: "/claims",
    },
    {
      title: t("stats.pendingReview"),
      value: totalPending.toString(),
      icon: Clock,
      color: "text-amber-500",
      link: isPrivileged ? "/approvals" : "/claims",
    },
    {
      title: t("stats.approved"),
      value: totalApproved.toString(),
      icon: CheckCircle,
      color: "text-emerald-500",
      link: "/claims",
    },
    {
      title: t("stats.totalAmount"),
      value: currencyFormatter.format(totalAmount),
      icon: IndianRupee,
      color: "text-foreground",
      link: "/claims",
    },
  ];

  if (isLoading || isTeamLoading) {
    return <div className="py-12 text-center text-muted-foreground">{t("loading")}</div>;
  }

  if (isError || isTeamError) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-destructive">
          {(error || teamError) instanceof Error
            ? (error || teamError)?.message
            : t("loadError")}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void refetch();
            if (isPrivileged) void refetchTeam();
          }}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("roleDashboard", { role: roleName })}</p>
        </div>
        <Button
          variant="enterprise"
          size="lg"
          className="gap-2"
          onClick={() => navigate("/addclaims")}
        >
          <Plus className="w-4 h-4" />
          {t("newClaim")}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              onClick={() => navigate(stat.link)}
              className="border border-border/80 bg-card hover:border-border transition-colors cursor-pointer"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isPrivileged && (
        <Card>
          <CardHeader>
            <CardTitle>{t("teamOverview")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div
              className="rounded-lg bg-muted p-4 cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => navigate("/approvals")}
            >
              <p className="text-xs text-muted-foreground font-medium">{t("stats.pendingReview")}</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-amber-500 mt-1">
                {teamExpenses.filter((expense) => expense.status === "PENDING").length}
              </p>
            </div>
            <div
              className="rounded-lg bg-muted p-4 cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => navigate("/all-claims")}
            >
              <p className="text-xs text-muted-foreground font-medium">{t("stats.approved")}</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-500 mt-1">
                {teamExpenses.filter((expense) => expense.status === "APPROVED").length}
              </p>
            </div>
            <div
              className="rounded-lg bg-muted p-4 cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => navigate("/all-claims")}
            >
              <p className="text-xs text-muted-foreground font-medium">{t("stats.totalAmount")}</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1">
                {currencyFormatter.format(
                  teamExpenses.reduce((sum, expense) => sum + expense.amount, 0)
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Claims */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>{t("recentClaims")}</CardTitle>
              {recentClaims.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/claims")}>
                  {t("viewAllClaims")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {recentClaims.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                    <Receipt className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">No claims submitted yet</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Submit your first expense claim to start the reimbursement workflow.
                  </p>
                  <Button variant="enterprise" size="sm" onClick={() => navigate("/addclaims")}>
                    <Plus className="w-4 h-4 mr-1" />
                    {t("submitNewClaim")}
                  </Button>
                </div>
              ) : (
                <>
                  {recentClaims.map((claim) => (
                    <ClaimCard key={claim.id} claim={claim} />
                  ))}
                  <Button variant="ghost" className="w-full" onClick={() => navigate("/claims")}>
                    {t("viewAllClaims")}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Live Activity */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>{t("quickActions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="enterprise" className="w-full justify-start gap-2" onClick={() => navigate("/addclaims")}>
                <Plus className="w-4 h-4" />
                {t("submitNewClaim")}
              </Button>
              {isPrivileged && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/approvals")}
                >
                  <Clock className="w-4 h-4" />
                  {t("reviewPending")}
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={() => navigate(user?.role === "EMPLOYEE" ? "/claims" : "/all-claims")}
              >
                <TrendingUp className="w-4 h-4" />
                {t("viewReports")}
              </Button>
            </CardContent>
          </Card>

          {/* Dynamic Live Notifications */}
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{t("notifications")}</CardTitle>
              <span className="text-[11px] text-muted-foreground">Live feed</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {expenses.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <CheckCircle className="w-6 h-6 mx-auto mb-1 text-success opacity-75" />
                  No active alerts. All claims are settled or up to date.
                </div>
              ) : (
                expenses.slice(0, 3).map((exp) => {
                  const isSentBack = exp.approvalStatus === "SENT_BACK" || exp.status === "rejected";
                  const isApproved = exp.status === "APPROVED";
                  const isPaid = exp.status === "PAID";

                  return (
                    <div
                      key={exp.id}
                      onClick={() => navigate("/claims")}
                      className="p-3 bg-muted/60 rounded-lg hover:bg-muted transition-colors cursor-pointer border border-border/50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground truncate">
                          Claim #{exp.id}: {exp.category}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          ₹{exp.amount.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isSentBack ? (
                          <span className="text-destructive font-medium">
                            Sent back: {exp.reviewComment || "Please review & adjust"}
                          </span>
                        ) : isPaid ? (
                          <span className="text-success font-medium">Reimbursement settled & paid</span>
                        ) : isApproved ? (
                          <span className="text-success font-medium">Approved by reviewer</span>
                        ) : (
                          <span>Under review ({exp.currentStep || "1-Up Manager"})</span>
                        )}
                      </p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
