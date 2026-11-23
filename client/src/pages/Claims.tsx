import { useMemo, useState } from "react";
import { Plus, Filter, Search, Download, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/custom/Button";
import { Input } from "@/components/custom/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/custom/Select";
import ClaimCard, { Claim } from "@/components/claims/ClaimCard";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useExpenses } from "@/hooks/useExpenses";
import { useAuth } from "@/context/AuthContext";

const Claims = () => {
  const { t, i18n } = useTranslation("claims");
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "all";

  const { data: expenses = [], isLoading, isError, error, refetch } = useExpenses({ scope: "mine" });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const claims = useMemo<Claim[]>(
    () =>
      expenses.map((expense) => {
        let approverName = null;
        if (expense.currentApprover) {
          approverName = `${expense.currentApprover.name || expense.currentApprover.email} (${expense.currentApprover.role})`;
        } else if (expense.approvalStatus === "IN_ACCOUNTING_REVIEW") {
          approverName = "Finance / AP Processor Queue";
        }
        return {
          id: String(expense.id),
          title: expense.category,
          amount: expense.amount,
          description: expense.description,
          date: expense.date,
          status: expense.status.toLowerCase(),
          category: expense.category,
          submittedById: expense.userId,
          reviewComment: expense.reviewComment,
          approvalStatus: expense.approvalStatus,
          paymentStatus: expense.paymentStatus,
          currentStep: expense.currentStep,
          currentApproverName: approverName,
          costCenterCode: expense.costCenterCode,
          paymentReference: expense.paymentReference,
          receiptUrl: expense.receiptUrl,
          rawExpense: expense,
        };
      }),
    [expenses]
  );

  // Filter claims based on search and filters
  const filteredClaims = claims.filter(claim => {
    const matchesSearch = claim.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || claim.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || claim.category === categoryFilter;

    let matchesDate = true;
    if (dateFilter !== "all") {
      const claimDate = new Date(claim.date);
      const now = new Date();
      if (dateFilter === "30days") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        matchesDate = claimDate >= thirtyDaysAgo;
      } else if (dateFilter === "thisMonth") {
        matchesDate = claimDate.getMonth() === now.getMonth() && claimDate.getFullYear() === now.getFullYear();
      } else if (dateFilter === "thisYear") {
        matchesDate = claimDate.getFullYear() === now.getFullYear();
      }
    }

    return matchesSearch && matchesStatus && matchesCategory && matchesDate;
  });

  const totalPages = Math.ceil(filteredClaims.length / pageSize) || 1;
  const paginatedClaims = filteredClaims.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const categories = Array.from(new Set(claims.map(claim => claim.category)));
  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  });

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">{t("loading")}</div>;
  }

  if (isError) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-destructive">
          {error instanceof Error ? error.message : t("loadError")}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              const escapeCsvValue = (value: string | number) =>
                `"${String(value).replace(/"/g, '""')}"`;
              const csvContent = [
                [
                  t("csvHeaders.id"),
                  t("csvHeaders.title"),
                  t("csvHeaders.amount"),
                  t("csvHeaders.description"),
                  t("csvHeaders.date"),
                  t("csvHeaders.status"),
                  t("csvHeaders.category"),
                ],
                ...filteredClaims.map(claim => [
                  claim.id,
                  claim.title,
                  claim.amount,
                  claim.description,
                  claim.date,
                  claim.status,
                  claim.category
                ])
              ]
                .map(row => row.map(escapeCsvValue).join(","))
                .join("\n");

              const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.setAttribute("download", "claims.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            <Download className="w-4 h-4" />
            {t("export")}
          </Button>

          <Button variant="enterprise" className="gap-2">
            <Plus className="w-4 h-4" />
            <Link to="/addclaims">{t("newClaim")}</Link>
          </Button>
        </div>
      </div>

      {claims.length === 0 ? (
        <div className="space-y-4 py-12 text-center">
          <p className="text-muted-foreground">{t("noClaimsYet")}</p>
          <Button variant="enterprise">
            <Link to="/addclaims">{t("newClaim")}</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 p-4 bg-card rounded-lg border border-border">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder={t("filter.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filter.allStatuses")}</SelectItem>
                <SelectItem value="pending">{t("filter.pending")}</SelectItem>
                <SelectItem value="approved">{t("filter.approved")}</SelectItem>
                <SelectItem value="rejected">{t("filter.rejected")}</SelectItem>
                <SelectItem value="paid">{t("filter.paid")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder={t("filter.category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filter.allCategories")}</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(val) => { setDateFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="thisYear">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Claims Grid */}
          <div className="grid gap-4">
            {paginatedClaims.length > 0 ? (
              paginatedClaims.map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  currentUserId={user?.id}
                />
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t("noClaims")}</h3>
                <p className="text-muted-foreground mb-4">
                  {t("emptyMessage")}
                </p>
                <Button variant="outline" onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setCategoryFilter("all");
                  setDateFilter("all");
                  setCurrentPage(1);
                }}>
                  {t("clearFilters")}
                </Button>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredClaims.length)} of {filteredClaims.length} claims
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 gap-1 text-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-xs font-semibold px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 gap-1 text-xs"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          {filteredClaims.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {filteredClaims.length}
                </div>
                <div className="text-sm text-muted-foreground">{t("summary.totalClaims")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">
                  {filteredClaims.filter(c => c.status === 'pending').length}
                </div>
                <div className="text-sm text-muted-foreground">{t("summary.pending")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">
                  {filteredClaims.filter(c => c.status === 'approved' || c.status === 'paid').length}
                </div>
                <div className="text-sm text-muted-foreground">{t("summary.approved")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {currencyFormatter.format(
                    filteredClaims.reduce((sum, claim) => sum + claim.amount, 0)
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{t("summary.totalValue")}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Claims;