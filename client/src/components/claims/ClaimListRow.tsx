import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Paperclip,
  History,
  AlertCircle,
  Receipt,
  Check,
  X,
  CreditCard,
  ExternalLink,
  Edit3,
  Send,
  GitFork,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/custom/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/custom/Select";
import { Input } from "@/components/custom/Input";
import { Label } from "@/components/custom/Label";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowStepperModal } from "@/components/claims/WorkflowStepperModal";
import { getToken } from "@/lib/auth";
import {
  useCostCenters,
  useSubmitExpense,
  useUpdateExpense,
  useUploadReceipt,
  Expense,
} from "@/hooks/useExpenses";
import { toast } from "sonner";
import { type Claim } from "@/components/claims/ClaimCard";

export interface ClaimListRowProps {
  claim: Claim;
  onApprove?: (claimId: string) => void;
  onReject?: (claimId: string) => void;
  onForward?: (claimId: string) => void;
  onPay?: (claimId: string) => void;
  showActions?: boolean;
  role?: string;
  currentUserId?: number;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

const getWorkflowBadgeStyle = (approvalStatus?: string) => {
  switch (approvalStatus) {
    case "PENDING_MANAGER_APPROVAL":
      return { label: "Manager Review (1-Up)", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
    case "PENDING_AUTHORIZED_APPROVAL":
      return { label: "Authorized Approver", className: "bg-purple-500/10 text-purple-400 border-purple-500/30" };
    case "PENDING_COA":
      return { label: "Cost Object (COA)", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
    case "IN_ACCOUNTING_REVIEW":
      return { label: "Accounting Audit", className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" };
    case "APPROVED":
      return { label: "Approved (Cleared)", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
    case "SENT_BACK":
      return { label: "Sent Back to Employee", className: "bg-rose-500/10 text-rose-400 border-rose-500/30" };
    case "DRAFT":
      return { label: "Draft", className: "bg-muted text-muted-foreground border-border" };
    default:
      return null;
  }
};

export const ClaimListRow: React.FC<ClaimListRowProps> = ({
  claim,
  onApprove,
  onReject,
  onForward,
  onPay,
  showActions = false,
  role,
  currentUserId,
  isSelected,
  onSelect,
}) => {
  const { t, i18n } = useTranslation("claims");
  const [isExpanded, setIsExpanded] = useState(false);
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

  const isPending =
    claim.status === "pending" ||
    claim.approvalStatus?.startsWith("PENDING_") ||
    claim.approvalStatus === "IN_ACCOUNTING_REVIEW";
  const canApprove =
    (role === "manager" || role === "admin" || role === "finance") && isPending && !isOwnClaim;
  const canPay =
    (role === "admin" || role === "finance") &&
    (claim.status === "approved" || claim.approvalStatus === "APPROVED") &&
    !isOwnClaim &&
    claim.paymentStatus !== "PAID";
  const canResubmit =
    isOwnClaim &&
    (claim.approvalStatus === "SENT_BACK" || claim.approvalStatus === "DRAFT" || claim.status === "rejected");

  const workflowBadge = getWorkflowBadgeStyle(claim.approvalStatus);

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

  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(claim.amount);

  return (
    <div
      className={`border rounded-lg transition-colors overflow-hidden ${
        isExpanded ? "border-primary/50 bg-card shadow-xs" : "border-border/80 bg-card/60 hover:border-border hover:bg-card/90"
      }`}
    >
      {/* Primary Row: High-Density Horizontal Layout */}
      <div
        className="flex items-center justify-between gap-3 px-3.5 py-3 cursor-pointer select-none text-xs"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Left: Checkbox + ID + Claimant */}
        <div className="flex items-center gap-3 min-w-[200px] shrink-0">
          {onSelect && (
            <input
              type="checkbox"
              checked={isSelected || false}
              onChange={(e) => {
                e.stopPropagation();
                onSelect(e.target.checked);
              }}
              className="rounded border-border bg-background text-primary focus:ring-1 focus:ring-primary h-3.5 w-3.5 cursor-pointer"
            />
          )}

          <span className="font-mono font-semibold text-foreground bg-muted/50 border border-border/60 px-1.5 py-0.5 rounded text-[11px] tabular-nums">
            #{claim.id}
          </span>

          <div className="truncate">
            <p className="font-medium text-foreground truncate">{claim.submittedBy || "Employee"}</p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground/70" />
              <span>{new Intl.DateTimeFormat(i18n.language).format(new Date(claim.date))}</span>
            </p>
          </div>
        </div>

        {/* Center: Category + Cost Center + Badges */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="truncate flex-1">
            <span className="font-semibold text-foreground text-xs truncate block">{claim.title}</span>
            <span className="text-[11px] text-muted-foreground truncate block">{claim.description}</span>
          </div>

          {(claim.costCenterCode || claim.rawExpense?.costCenterCode) && (
            <span className="hidden md:inline-block font-mono text-[11px] bg-muted/60 border border-border/50 px-2 py-0.5 rounded text-muted-foreground shrink-0">
              CC: {claim.costCenterCode || claim.rawExpense?.costCenterCode}
            </span>
          )}

          {/* Workflow Badge */}
          <div className="shrink-0 hidden sm:block">
            {workflowBadge ? (
              <Badge variant="outline" className={`text-[11px] font-medium border ${workflowBadge.className}`}>
                {workflowBadge.label}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[11px] font-medium">
                {claim.status}
              </Badge>
            )}
          </div>

          {claim.paymentStatus === "PAID" && (
            <Badge variant="outline" className="shrink-0 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              Paid {claim.paymentReference ? `• UTR: ${claim.paymentReference}` : ""}
            </Badge>
          )}
        </div>

        {/* Right: Amount + Actions + Expand Chevron */}
        <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="text-right">
            <span className="font-mono tabular-nums font-semibold text-sm sm:text-base text-foreground">
              {formattedAmount}
            </span>
          </div>

          {/* Inline Action Buttons (Reference Images 2 & 3) */}
          {showActions && canApprove && (
            <div className="flex items-center gap-1 pl-1 border-l border-border/60">
              {onApprove && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onApprove(claim.id)}
                  className="h-7 px-2 text-xs font-medium text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                  title="Approve Claim"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Approve
                </Button>
              )}
              {onReject && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReject(claim.id)}
                  className="h-7 px-2 text-xs font-medium text-rose-400 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20"
                  title="Reject Claim"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Reject
                </Button>
              )}
              {onForward && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onForward(claim.id)}
                  className="h-7 px-2 text-xs"
                  title="Forward for higher approval"
                >
                  <GitFork className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}

          {showActions && canPay && onPay && (
            <Button
              size="sm"
              variant="enterprise"
              onClick={() => onPay(claim.id)}
              className="h-7 px-2.5 text-xs font-semibold gap-1"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Pay
            </Button>
          )}

          {/* Expand / Collapse Chevron Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title={isExpanded ? "Collapse preview" : "Expand preview"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Same-Screen Preview Drawer (Reference 2 & 3) */}
      {isExpanded && (
        <div className="border-t border-border/80 bg-muted/20 p-4 space-y-4 animate-in fade-in-50 duration-150 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left 2 Cols: Details, Allocation, Audit notes */}
            <div className="lg:col-span-2 space-y-3">
              <div>
                <span className="font-semibold text-foreground text-xs block mb-1">Business Description & Justification</span>
                <p className="text-muted-foreground bg-card border border-border/70 p-2.5 rounded-md text-xs leading-relaxed">
                  {claim.description || "No detailed justification entered."}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-card border border-border/70 p-2 rounded-md">
                  <span className="text-[11px] text-muted-foreground block font-medium">Claim Category</span>
                  <span className="font-medium text-foreground">{claim.category}</span>
                </div>
                <div className="bg-card border border-border/70 p-2 rounded-md">
                  <span className="text-[11px] text-muted-foreground block font-medium">Cost Center</span>
                  <span className="font-mono text-foreground">{claim.costCenterCode || claim.rawExpense?.costCenterCode || "General"}</span>
                </div>
                <div className="bg-card border border-border/70 p-2 rounded-md">
                  <span className="text-[11px] text-muted-foreground block font-medium">Submission Date</span>
                  <span className="text-foreground">{new Intl.DateTimeFormat(i18n.language).format(new Date(claim.date))}</span>
                </div>
              </div>

              {/* Current Assignee / Queue */}
              {claim.currentApproverName && (
                <div className="flex items-center gap-2 bg-muted/40 border border-border/70 p-2 rounded-md text-muted-foreground">
                  <span className="font-semibold text-foreground">Current Queue:</span>
                  <span>{claim.currentApproverName}</span>
                </div>
              )}

              {/* Disbursal Reference Pill */}
              {claim.paymentStatus === "PAID" && claim.paymentReference && (
                <div className="rounded border border-border/80 bg-muted/40 px-3 py-2 text-xs flex items-center justify-between">
                  <span className="font-medium flex items-center gap-1.5 text-muted-foreground">
                    <Receipt className="w-3.5 h-3.5 text-foreground" />
                    Reimbursement Disbursed via Bank Transfer
                  </span>
                  <span className="font-mono text-xs text-foreground tabular-nums">
                    UTR: <strong className="font-semibold">{claim.paymentReference}</strong>
                  </span>
                </div>
              )}

              {/* Reviewer Sent Back Banner */}
              {(claim.approvalStatus === "SENT_BACK" || (claim.status === "rejected" && claim.reviewComment)) && (
                <div className="rounded-md bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-400 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    Sent Back for Correction:
                  </div>
                  <p className="italic pl-5">
                    &quot;{claim.reviewComment || "Please review feedback, attach required bills, and resubmit."}&quot;
                  </p>
                </div>
              )}

              {/* Action Buttons in Drawer */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWorkflowModal(true)}
                  className="h-7 px-2.5 text-xs gap-1"
                >
                  <History className="w-3.5 h-3.5" />
                  View Approval Audit Trail
                </Button>

                {fullReceiptUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReceiptModal(true)}
                    className="h-7 px-2.5 text-xs gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Verified Tax Voucher
                  </Button>
                )}

                {canResubmit && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditAmount(claim.amount.toString());
                        setEditDescription(claim.description);
                        setEditCategory(claim.category);
                        setEditCostCenter(claim.costCenterCode || claim.rawExpense?.costCenterCode || "");
                        setEditFile(null);
                        setShowEditModal(true);
                      }}
                      className="h-7 px-2.5 text-xs gap-1 text-primary border-primary/40"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit &amp; Correct
                    </Button>
                    <Button
                      size="sm"
                      variant="enterprise"
                      onClick={() => submitExpense.mutate(claim.id)}
                      disabled={submitExpense.isPending}
                      className="h-7 px-2.5 text-xs gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {submitExpense.isPending ? "Submitting..." : "Resubmit"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Right 1 Col: Attached Document / Invoice Preview */}
            <div className="bg-card border border-border/80 rounded-lg p-3 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                  Attached Document
                </span>
                {fullReceiptUrl && (
                  <a
                    href={fullReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    Open New Tab <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {fullReceiptUrl ? (
                <div
                  onClick={() => setShowReceiptModal(true)}
                  className="group relative h-36 rounded border border-border/60 bg-muted/30 overflow-hidden flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {isPdf ? (
                    <div className="text-center p-2 text-muted-foreground group-hover:text-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-1 text-primary/80" />
                      <span className="text-[11px] block font-mono">PDF Tax Receipt</span>
                      <span className="text-[10px] text-muted-foreground">Click to preview document</span>
                    </div>
                  ) : (
                    <>
                      <img
                        src={fullReceiptUrl}
                        alt="Attached Bill"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-medium">
                        Click to enlarge
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="h-36 rounded border border-dashed border-border/80 flex flex-col items-center justify-center text-muted-foreground p-3 text-center">
                  <Paperclip className="w-6 h-6 mb-1 opacity-50" />
                  <span className="text-[11px]">No bill or invoice attached</span>
                </div>
              )}

              <div className="pt-1 text-[11px] text-muted-foreground/80 flex items-center justify-between">
                <span>Compliance Verified</span>
                <span className="font-mono">#EXP-{claim.id}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Stepper Modal */}
      {showWorkflowModal && (
        <WorkflowStepperModal
          expense={claim.rawExpense}
          isOpen={showWorkflowModal}
          onClose={() => setShowWorkflowModal(false)}
        />
      )}

      {/* Bill / Receipt Viewer Dialog */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-primary" />
              Attached Bill &amp; Tax Receipt
            </DialogTitle>
            <DialogDescription>
              Claim #{claim.id} — {claim.title} ({formattedAmount})
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 flex-1 overflow-auto flex items-center justify-center bg-muted/20 rounded-lg p-2 border">
            {fullReceiptUrl ? (
              isPdf ? (
                <iframe
                  src={fullReceiptUrl}
                  title={`Receipt for Claim #${claim.id}`}
                  className="w-full h-[65vh] rounded border"
                />
              ) : (
                <img
                  src={fullReceiptUrl}
                  alt={`Receipt for Claim #${claim.id}`}
                  className="max-h-[65vh] w-auto max-w-full rounded object-contain shadow-sm"
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground py-8">No receipt file uploaded.</p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground font-mono">
              {effectiveReceiptUrl ? effectiveReceiptUrl.split("/").pop() : "No file"}
            </span>
            <div className="flex gap-2">
              {fullReceiptUrl && (
                <a
                  href={fullReceiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </a>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowReceiptModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Claim Dialog */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit &amp; Correct Expense Claim</DialogTitle>
            <DialogDescription>
              Update claim details and attach necessary bills before resubmission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit-amount" className="text-xs font-semibold">Amount (INR ₹)</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="edit-category" className="text-xs font-semibold">Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Meals & Entertainment">Meals &amp; Entertainment</SelectItem>
                  <SelectItem value="Travel & Transportation">Travel &amp; Transportation</SelectItem>
                  <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                  <SelectItem value="Training & Certifications">Training &amp; Certifications</SelectItem>
                  <SelectItem value="Accommodation">Accommodation</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {costCenters.length > 0 && (
              <div>
                <Label htmlFor="edit-cc" className="text-xs font-semibold">Cost Center</Label>
                <Select value={editCostCenter} onValueChange={setEditCostCenter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Assign Cost Center" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.code}>
                        {cc.code} - {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="edit-desc" className="text-xs font-semibold">Description &amp; Justification</Label>
              <Textarea
                id="edit-desc"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="edit-receipt" className="text-xs font-semibold">Upload New Receipt / Invoice (Optional)</Label>
              <Input
                id="edit-receipt"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="enterprise" onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
