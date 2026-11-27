import { useState } from "react";
import {
  Receipt,
  Calendar,
  GitFork,
  History,
  Paperclip,
  ExternalLink,
  Edit3,
  Send,
  FileText,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/custom/Button";
import { Card, CardContent, CardHeader } from "@/components/custom/Card";
import { Badge } from "@/components/custom/Badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/custom/Input";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { WorkflowStepperModal } from "./WorkflowStepperModal";
import { getToken } from "@/lib/auth";
import {
  Expense,
  useSubmitExpense,
  useUpdateExpense,
  useUploadReceipt,
  useCostCenters,
} from "@/hooks/useExpenses";

export interface Claim {
  id: string;
  title: string;
  amount: number;
  description: string;
  date: string;
  status: string;
  category: string;
  submittedBy?: string;
  submittedById?: number;
  reviewComment?: string | null;
  approvalStatus?: string;
  paymentStatus?: string;
  paymentReference?: string | null;
  currentStep?: string;
  currentApproverName?: string | null;
  costCenterCode?: string | null;
  receiptUrl?: string | null;
  rawExpense?: Expense;
}

interface ClaimCardProps {
  claim: Claim;
  onApprove?: (claimId: string) => void;
  onReject?: (claimId: string) => void;
  onForward?: (claimId: string) => void;
  onPay?: (claimId: string) => void;
  showActions?: boolean;
  role?: string;
  currentUserId?: number;
}

const getWorkflowBadgeStyle = (approvalStatus?: string) => {
  switch (approvalStatus) {
    case "PENDING_MANAGER_APPROVAL":
      return { label: "Manager Review (1-Up)", className: "bg-blue-500/10 text-blue-600 border-blue-500/30" };
    case "PENDING_AUTHORIZED_APPROVAL":
      return { label: "Authorized Approver", className: "bg-purple-500/10 text-purple-600 border-purple-500/30" };
    case "PENDING_COA":
      return { label: "Cost Object Review (COA)", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
    case "IN_ACCOUNTING_REVIEW":
      return { label: "Accounting Review", className: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" };
    case "APPROVED":
      return { label: "Approved (Cleared)", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
    case "SENT_BACK":
      return { label: "Sent Back to Employee", className: "bg-rose-500/10 text-rose-600 border-rose-500/30" };
    case "DRAFT":
      return { label: "Draft", className: "bg-muted text-muted-foreground border-border" };
    default:
      return null;
  }
};

const ClaimCard = ({ 
  claim, 
  onApprove, 
  onReject, 
  onForward, 
  onPay, 
  showActions = false, 
  role,
  currentUserId,
}: ClaimCardProps) => {
  const { t } = useTranslation("claims");
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Mutations
  const submitExpense = useSubmitExpense();
  const updateExpense = useUpdateExpense();
  const uploadReceipt = useUploadReceipt();
  const { data: costCenters = [] } = useCostCenters();

  // Edit form state
  const [editAmount, setEditAmount] = useState(claim.amount.toString());
  const [editDescription, setEditDescription] = useState(claim.description);
  const [editCategory, setEditCategory] = useState(claim.category);
  const [editCostCenter, setEditCostCenter] = useState(claim.costCenterCode || claim.rawExpense?.costCenterCode || "");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isOwnClaim = claim.submittedById === currentUserId;
  const token = getToken();
  const effectiveReceiptUrl = claim.receiptUrl || claim.rawExpense?.receiptUrl;
  const isPdf = effectiveReceiptUrl?.toLowerCase().endsWith(".pdf");

  const fullReceiptUrl = effectiveReceiptUrl
    ? `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"}/api/expenses/${claim.id}/receipt${token ? `?token=${encodeURIComponent(token)}` : ""}`
    : null;

  const statusInfo = ({
    pending: { label: t("status.pending"), className: "status-pending" },
    approved: { label: t("status.approved"), className: "status-approved" },
    rejected: { label: t("status.rejected"), className: "status-rejected" },
    paid: { label: t("status.paid"), className: "status-paid" },
  } as Record<string, { label: string; className: string }>)[claim.status] || {
    label: claim.status,
    className: "status-pending",
  };

  const workflowBadge = getWorkflowBadgeStyle(claim.approvalStatus);

  const openEditModal = () => {
    setEditAmount(claim.amount.toString());
    setEditDescription(claim.description);
    setEditCategory(claim.category);
    setEditCostCenter(claim.costCenterCode || claim.rawExpense?.costCenterCode || "");
    setEditFile(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    const numAmount = parseFloat(editAmount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (!editDescription.trim()) {
      toast.error("Please enter a description.");
      return;
    }

    setIsSaving(true);
    try {
      let newReceiptUrl = effectiveReceiptUrl;
      if (editFile) {
        const uploadRes = await uploadReceipt.mutateAsync(editFile);
        newReceiptUrl = uploadRes.receiptUrl;
      }

      await updateExpense.mutateAsync({
        id: claim.id,
        amount: numAmount,
        description: editDescription.trim(),
        category: editCategory,
        costCenterCode: editCostCenter || null,
        receiptUrl: newReceiptUrl,
      });

      toast.success("Claim updated successfully.");
      setShowEditModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update claim.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderActions = () => {
    const isPending = claim.status === "pending" || claim.approvalStatus?.startsWith("PENDING_") || claim.approvalStatus === "IN_ACCOUNTING_REVIEW";
    const canApprove = (role === "manager" || role === "admin" || role === "finance") && isPending && !isOwnClaim;

    if (showActions && canApprove) {
      return (
        <div className="flex flex-wrap gap-2 items-center">
          {onForward && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onForward(claim.id)}
              className="text-xs"
            >
              <GitFork className="w-3.5 h-3.5 mr-1" />
              Forward
            </Button>
          )}
          <Button 
            size="sm" 
            variant="destructive"
            onClick={() => onReject?.(claim.id)}
            className="text-xs"
          >
            {t("actions.reject")}
          </Button>
          <Button 
            size="sm" 
            variant="success"
            onClick={() => onApprove?.(claim.id)}
            className="text-xs"
          >
            {t("actions.approve")}
          </Button>
        </div>
      );
    }

    if (showActions && (role === "admin" || role === "finance") && (claim.status === "approved" || claim.approvalStatus === "APPROVED") && !isOwnClaim && claim.paymentStatus !== "PAID") {
      return (
        <Button 
          size="sm" 
          variant="enterprise"
          onClick={() => onPay?.(claim.id)}
          className="text-xs"
        >
          {t("actions.processPayment")}
        </Button>
      );
    }

    // Employee Actions: When an employee owns this claim and it is SENT_BACK or DRAFT
    const canResubmit = isOwnClaim && (claim.approvalStatus === "SENT_BACK" || claim.approvalStatus === "DRAFT" || claim.status === "rejected");
    if (canResubmit) {
      return (
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            size="sm"
            variant="outline"
            onClick={openEditModal}
            className="text-xs border-primary/40 text-primary hover:bg-primary/10"
          >
            <Edit3 className="w-3.5 h-3.5 mr-1" />
            Edit & Correct
          </Button>
          <Button
            size="sm"
            variant="enterprise"
            onClick={() => submitExpense.mutate(claim.id)}
            disabled={submitExpense.isPending}
            className="text-xs"
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            {submitExpense.isPending ? "Submitting..." : "Resubmit Claim"}
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <Card className="border border-border/80 bg-card hover:border-border transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Receipt className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-base">{claim.title}</h3>
                <p className="text-sm text-muted-foreground">{claim.category}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {/* Attached Bill / Receipt Button */}
              {fullReceiptUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReceiptModal(true)}
                  className="h-8 px-2.5 text-xs text-primary border-primary/40 bg-primary/5 hover:bg-primary/15 font-medium"
                  title="View attached bill or tax invoice"
                >
                  <Paperclip className="w-3.5 h-3.5 mr-1" />
                  View Bill
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground/60 italic px-1">
                  No bill attached
                </span>
              )}

              {workflowBadge ? (
                <Badge variant="outline" className={`text-[11px] font-medium border ${workflowBadge.className}`}>
                  {workflowBadge.label}
                </Badge>
              ) : (
                <Badge 
                  variant="outline" 
                  className={statusInfo.className}
                >
                  {statusInfo.label}
                </Badge>
              )}
              {claim.paymentStatus === "PAID" && (
                <Badge variant="outline" className="text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  Paid {claim.paymentReference ? `• UTR: ${claim.paymentReference}` : ""}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWorkflowModal(true)}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="View Approval Workflow & Audit Trail"
              >
                <History className="w-3.5 h-3.5 mr-1" />
                Audit Trail
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{claim.description}</p>
            
            {claim.currentApproverName && (
              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border flex items-center gap-2">
                <span className="font-semibold text-foreground">Current Queue:</span>
                <span>{claim.currentApproverName}</span>
              </div>
            )}

            {/* Reviewer / Manager Sent Back Feedback Banner */}
            {(claim.approvalStatus === "SENT_BACK" || (claim.status === "rejected" && claim.reviewComment)) && (
              <div className="rounded-md bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-700 dark:text-rose-400 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  Sent Back for Correction:
                </div>
                <p className="italic pl-5">
                  &quot;{claim.reviewComment || "Please review feedback, attach required bills, and resubmit."}&quot;
                </p>
              </div>
            )}
            
            {/* Payment Settlement UTR Display */}
            {claim.paymentStatus === "PAID" && claim.paymentReference && (
              <div className="rounded border border-border/70 bg-muted/40 px-3 py-2 text-xs flex items-center justify-between">
                <span className="font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Receipt className="w-3.5 h-3.5 text-foreground" />
                  Reimbursement Disbursed
                </span>
                <span className="font-mono text-xs text-foreground tabular-nums">
                  UTR: <strong className="font-semibold">{claim.paymentReference}</strong>
                </span>
              </div>
            )}
            
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{new Intl.DateTimeFormat(i18n.language).format(new Date(claim.date))}</span>
                </div>
                {claim.submittedBy && (
                  <span>{t("submittedBy", { name: claim.submittedBy })}</span>
                )}
                {(claim.costCenterCode || claim.rawExpense?.costCenterCode) && (
                  <span className="text-xs font-mono bg-muted/60 px-2 py-0.5 rounded border border-border/50 text-muted-foreground">
                    CC: {claim.costCenterCode || claim.rawExpense?.costCenterCode}
                  </span>
                )}
              </div>
              
              <div className="flex items-center">
                <span className="text-lg font-semibold font-mono tabular-nums text-foreground">
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                  }).format(claim.amount)}
                </span>
              </div>
            </div>

            {renderActions() && (
              <div className="pt-3 border-t border-border flex justify-end">
                {renderActions()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bill / Receipt Viewer Dialog */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-primary" />
              Attached Bill & Tax Receipt
            </DialogTitle>
            <DialogDescription>
              Claim #{claim.id} — {claim.title} (₹{claim.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })})
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 flex-1 overflow-auto flex items-center justify-center bg-muted/20 rounded-lg p-2 border">
            {fullReceiptUrl ? (
              isPdf ? (
                <iframe
                  src={fullReceiptUrl}
                  title="Receipt Document"
                  className="w-full h-[60vh] rounded border"
                />
              ) : (
                <img
                  src={fullReceiptUrl}
                  alt="Attached Receipt"
                  className="max-h-[60vh] max-w-full rounded object-contain shadow-sm"
                />
              )
            ) : (
              <p className="text-muted-foreground text-sm">No bill file available.</p>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Uploaded for verification and compliance audit.
            </span>
            {fullReceiptUrl && (
              <Button asChild size="sm" variant="outline">
                <a href={fullReceiptUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  Open in New Tab
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit & Correct Sent-Back Claim Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" />
              Edit & Correct Claim
            </DialogTitle>
            <DialogDescription>
              Update claim details and attach missing receipts before resubmitting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Amount (₹ INR)</label>
              <Input
                type="number"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full mt-1 rounded-md border border-input bg-background p-2.5 text-sm"
              >
                <option value="Expense">Expense</option>
                <option value="Travel">Travel</option>
                <option value="Medical">Medical</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Cost Center</label>
              <select
                value={editCostCenter}
                onChange={(e) => setEditCostCenter(e.target.value)}
                className="w-full mt-1 rounded-md border border-input bg-background p-2.5 text-sm"
              >
                <option value="">Default (No Split)</option>
                {costCenters.map((cc) => (
                  <option key={cc.code} value={cc.code}>
                    {cc.code} — {cc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full mt-1 rounded-md border border-input bg-background p-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Attach / Replace Bill</label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setEditFile(e.target.files ? e.target.files[0] : null)}
                className="mt-1"
              />
              {effectiveReceiptUrl && !editFile && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Current file: {effectiveReceiptUrl.split("/").pop()}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="enterprise" onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow Stepper & Audit Trail Modal */}
      {claim.rawExpense && (
        <WorkflowStepperModal
          expense={claim.rawExpense}
          isOpen={showWorkflowModal}
          onClose={() => setShowWorkflowModal(false)}
        />
      )}
    </>
  );
};

export default ClaimCard;
