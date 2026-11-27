import { useState } from "react";
import { Button } from "@/components/custom/Button";
import { ClaimListRow } from "@/components/claims/ClaimListRow";
import { DataTablePagination } from "@/components/custom/DataTablePagination";
import { Claim } from "@/components/claims/ClaimCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useApproveExpense,
  Expense,
  useExpenses,
  useRejectExpense,
  useApproveAndForwardExpense,
  useUserHierarchy,
} from "@/hooks/useExpenses";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, UserCheck, AlertCircle } from "lucide-react";

const toClaim = (expense: Expense): Claim => {
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
};

const Approvals = () => {
  const { t } = useTranslation("approvals");
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"my_action" | "all_pending">("my_action");

  // Query expenses
  const {
    data: expenses = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useExpenses({
    scope: "all",
    pendingApproval: activeTab === "my_action",
    status: activeTab === "all_pending" ? "PENDING" : undefined,
  });

  const { data: allUsers = [] } = useUserHierarchy();

  const approveExpense = useApproveExpense();
  const rejectExpense = useRejectExpense();
  const forwardExpense = useApproveAndForwardExpense();

  const [rejectingClaimId, setRejectingClaimId] = useState<string | null>(null);
  const [forwardingClaimId, setForwardingClaimId] = useState<string | null>(null);
  const [selectedForwardUser, setSelectedForwardUser] = useState<string>("");
  const [comment, setComment] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const paginatedExpenses = expenses.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">{t("loading")}</div>;
  }

  if (isError) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-destructive">
          {error instanceof Error ? error.message : t("loadError")}
        </p>
        <Button variant="outline" onClick={() => refetch()}>{t("retry")}</Button>
      </div>
    );
  }

  const submitRejection = () => {
    if (!rejectingClaimId || !comment.trim()) return;
    rejectExpense.mutate(
      { id: rejectingClaimId, comment: comment.trim() },
      {
        onSuccess: () => {
          setRejectingClaimId(null);
          setComment("");
        },
      }
    );
  };

  const submitForward = () => {
    if (!forwardingClaimId || !selectedForwardUser) return;
    forwardExpense.mutate(
      {
        id: forwardingClaimId,
        forwardToUserId: Number(selectedForwardUser),
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          setForwardingClaimId(null);
          setSelectedForwardUser("");
          setComment("");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            SVCORA_SpendX Expense Approvals
          </h1>
          <p className="text-muted-foreground">
            Manage multi-tier managerial, authorized, and cost-object approval queues.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "my_action" | "all_pending")}>
          <TabsList>
            <TabsTrigger value="my_action" className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4" />
              Pending My Action
            </TabsTrigger>
            <TabsTrigger value="all_pending" className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              All Pending Claims
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {expenses.length === 0 ? (
        <div className="py-16 text-center rounded-lg border border-dashed bg-muted/20">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-muted-foreground font-medium">
            {activeTab === "my_action"
              ? "You have no expense reports pending your approval or delegation."
              : "No pending claims found across the organization."}
          </p>
        </div>
      ) : (
        <div className="border border-border/80 rounded-lg overflow-hidden bg-card/40">
          <div className="divide-y divide-border/60">
            {paginatedExpenses.map((expense) => (
              <ClaimListRow
                key={expense.id}
                claim={toClaim(expense)}
                showActions
                role={user?.role.toLowerCase()}
                currentUserId={user?.id}
                onApprove={(claimId) => approveExpense.mutate(claimId)}
                onReject={(claimId) => {
                  setRejectingClaimId(claimId);
                  setComment("");
                }}
                onForward={(claimId) => {
                  setForwardingClaimId(claimId);
                  setSelectedForwardUser("");
                  setComment("");
                }}
              />
            ))}
          </div>
          <DataTablePagination
            currentPage={currentPage}
            totalItems={expenses.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="pending claims"
          />
        </div>
      )}

      {/* Send Back / Rejection Modal */}
      <Dialog
        open={Boolean(rejectingClaimId)}
        onOpenChange={(open) => {
          if (!open) setRejectingClaimId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Back Expense Report</DialogTitle>
            <DialogDescription>
              A mandatory comment is required explaining the audit finding or reason for return.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Specify missing receipt, out-of-policy item, or required adjustment..."
            className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingClaimId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!comment.trim() || rejectExpense.isPending}
              onClick={submitRejection}
            >
              Confirm Send Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve & Forward (Ad-Hoc Additional Reviewer) Modal */}
      <Dialog
        open={Boolean(forwardingClaimId)}
        onOpenChange={(open) => {
          if (!open) setForwardingClaimId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & Forward (Ad-Hoc Reviewer)</DialogTitle>
            <DialogDescription>
              Select an additional approver to review this claim before final financial clearance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Target Approver</label>
              <select
                value={selectedForwardUser}
                onChange={(e) => setSelectedForwardUser(e.target.value)}
                className="w-full mt-1 rounded-md border border-input bg-background p-2.5 text-sm"
              >
                <option value="">Select an approver from directory...</option>
                {allUsers
                  .filter((u) => u.id !== user?.id && u.role !== "EMPLOYEE")
                  .map((u) => {
                    const limitLabel =
                      u.approvalLimit === null || u.approvalLimit === undefined
                        ? "— Unlimited Authority"
                        : u.approvalLimit === 0
                        ? "— Review Only (₹0.00)"
                        : `— Limit: ₹${u.approvalLimit.toLocaleString("en-IN")}`;
                    return (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email} ({u.role}) {limitLabel}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Optional Note</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Reason for forwarding..."
                className="w-full mt-1 min-h-16 rounded-md border border-input bg-background p-2.5 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setForwardingClaimId(null)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedForwardUser || forwardExpense.isPending}
              onClick={submitForward}
            >
              Forward Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Approvals;
