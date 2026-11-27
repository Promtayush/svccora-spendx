import { useMemo, useState } from "react";
import { Download, Filter, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/custom/Button";
import { Input } from "@/components/custom/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/custom/Select";
import { ClaimListRow } from "@/components/claims/ClaimListRow";
import { DataTablePagination } from "@/components/custom/DataTablePagination";
import { type Claim } from "@/components/claims/ClaimCard";
import { useExpenses } from "@/hooks/useExpenses";
import { useTranslation } from "react-i18next";

const AllClaims = () => {
  const { t } = useTranslation("claims");
  const { data: expenses = [], isLoading, isError, error, refetch } = useExpenses({
    scope: "all",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

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
          submittedBy: expense.user.name || expense.user.email,
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

  const filteredClaims = claims.filter((claim) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      claim.title.toLowerCase().includes(query) ||
      claim.description.toLowerCase().includes(query) ||
      claim.submittedBy?.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || claim.status === statusFilter;

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

    return matchesSearch && matchesStatus && matchesDate;
  });

  const totalPages = Math.ceil(filteredClaims.length / pageSize) || 1;
  const paginatedClaims = filteredClaims.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportClaims = () => {
    const escapeCsvValue = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;
    const csvContent = [
      [
        t("allClaims.csvHeaders.id"),
        t("allClaims.csvHeaders.title"),
        t("allClaims.csvHeaders.amount"),
        t("allClaims.csvHeaders.description"),
        t("allClaims.csvHeaders.date"),
        t("allClaims.csvHeaders.status"),
        t("allClaims.csvHeaders.owner"),
      ],
      ...filteredClaims.map((claim) => [
        claim.id,
        claim.title,
        claim.amount,
        claim.description,
        claim.date,
        claim.status,
        claim.submittedBy || "",
      ]),
    ]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "all-claims.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">{t("allClaims.title")}</h1>
          <p className="text-muted-foreground">{t("allClaims.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportClaims}>
          <Download className="h-4 w-4" />
          {t("allClaims.export")}
        </Button>
      </div>

      {claims.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">{t("allClaims.empty")}</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("allClaims.searchPlaceholder")}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-44">
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

            <Select value={dateFilter} onValueChange={(val) => { setDateFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-44">
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

          {/* Claims List View */}
          {paginatedClaims.length > 0 ? (
            <div className="border border-border/80 rounded-lg overflow-hidden bg-card/40">
              <div className="divide-y divide-border/60">
                {paginatedClaims.map((claim) => (
                  <ClaimListRow key={claim.id} claim={claim} />
                ))}
              </div>
              <DataTablePagination
                currentPage={currentPage}
                totalItems={filteredClaims.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemLabel="claims"
              />
            </div>
          ) : (
            <div className="py-12 text-center border border-border/80 rounded-lg bg-card/40">
              <Filter className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t("allClaims.noMatches")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AllClaims;
