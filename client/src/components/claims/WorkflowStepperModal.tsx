import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/custom/Badge";
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, UserCheck, ShieldCheck, IndianRupee, Layers, Paperclip, ExternalLink } from "lucide-react";
import { Expense } from "@/hooks/useExpenses";
import { getToken } from "@/lib/auth";

interface WorkflowStepperModalProps {
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  { id: "DRAFT", label: "Submission", icon: CheckCircle2, desc: "Employee creates & submits report" },
  { id: "MANAGER_APPROVAL", label: "Manager Review", icon: UserCheck, desc: "1-Up operational validation" },
  { id: "AUTHORIZED_APPROVAL", label: "Authorized Approver", icon: ShieldCheck, desc: "Signing authority limit check" },
  { id: "COST_OBJECT_APPROVAL", label: "Cost Object (COA)", icon: Layers, desc: "Budget & allocation sign-off" },
  { id: "PROCESSOR_REVIEW", label: "Accounting Audit", icon: IndianRupee, desc: "Finance & AP compliance check" },
  { id: "COMPLETED", label: "Payment Settlement", icon: CheckCircle2, desc: "Extracted for payment & settled" },
];

export const WorkflowStepperModal = ({
  expense,
  isOpen,
  onClose,
}: WorkflowStepperModalProps) => {
  if (!expense) return null;

  const currentStep = expense.currentStep || "MANAGER_APPROVAL";
  const approvalStatus = expense.approvalStatus || "PENDING_MANAGER_APPROVAL";
  const history = expense.workflowHistory || [];
  const allocations = expense.allocations || [];

  const getStepStatus = (stepId: string, index: number) => {
    if (approvalStatus === "REJECTED" || approvalStatus === "SENT_BACK") {
      if (index === 0) return "completed";
      return "rejected";
    }

    const stepOrder = ["DRAFT", "MANAGER_APPROVAL", "AUTHORIZED_APPROVAL", "COST_OBJECT_APPROVAL", "PROCESSOR_REVIEW", "COMPLETED"];
    const currentIndex = stepOrder.indexOf(currentStep);
    const targetIndex = stepOrder.indexOf(stepId);

    if (approvalStatus === "APPROVED" || expense.status === "APPROVED" || expense.status === "PAID") {
      if (stepId === "COMPLETED" && expense.status !== "PAID") return "active";
      if (stepId === "COMPLETED" && expense.status === "PAID") return "completed";
      return "completed";
    }

    if (targetIndex < currentIndex) return "completed";
    if (targetIndex === currentIndex) return "active";
    return "pending";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              SVCORA_SpendX Approval Workflow
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">
              Claim #{expense.id}
            </Badge>
          </div>
          <DialogDescription>
            Lifecycle status, hierarchy traversal, and audit trail for {expense.category} (₹{expense.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
          </DialogDescription>
        </DialogHeader>

        {/* Current State Summary Banner */}
        <div className="p-4 rounded-lg bg-muted/40 border border-border/80 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs text-muted-foreground font-medium">Approval status</div>
            <div className="text-base font-semibold text-foreground flex items-center gap-2 mt-0.5">
              {approvalStatus.replace(/_/g, " ")}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Current assignee</div>
            <div className="text-sm font-medium mt-0.5 text-foreground">
              {expense.currentApprover
                ? `${expense.currentApprover.name || expense.currentApprover.email} (${expense.currentApprover.role})`
                : approvalStatus === "IN_ACCOUNTING_REVIEW"
                  ? "Finance / AP Processor Queue"
                  : approvalStatus === "APPROVED"
                    ? "Cleared for Payment"
                    : "None / Draft"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Reimbursement</div>
            <div className="text-sm font-medium mt-0.5 text-foreground">
              {expense.paymentStatus ? expense.paymentStatus.replace(/_/g, " ") : "NOT PAID"}
            </div>
          </div>
        </div>

        {/* Attached Bill / Receipt Preview if present */}
        {expense.receiptUrl && (
          <div className="p-3 rounded-lg border border-border/70 bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Attached Invoice / Bill:</span>
              <span className="text-xs text-muted-foreground font-mono">
                {expense.receiptUrl.split("/").pop()}
              </span>
            </div>
            <a
              href={`${import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"}/api/expenses/${expense.id}/receipt${getToken() ? `?token=${encodeURIComponent(getToken() || "")}` : ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Document
            </a>
          </div>
        )}

        {/* Payment Settlement UTR Reference Banner */}
        {expense.paymentReference && (
          <div className="border border-border/80 bg-muted/40 rounded-lg p-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Reimbursement Settled via Bank Transfer
            </span>
            <span className="text-xs font-mono font-medium text-foreground tabular-nums">
              UTR: <strong className="font-semibold">{expense.paymentReference}</strong>
            </span>
          </div>
        )}

        {/* Cleared for Payment Disbursal Action Banner */}
        {expense.status === "APPROVED" && expense.paymentStatus !== "PAID" && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <IndianRupee className="w-5 h-5 text-primary shrink-0" />
              <div>
                <div className="text-xs font-semibold text-primary">Cleared for Financial Disbursal</div>
                <div className="text-xs text-muted-foreground">All operational and accounting reviews have passed. Ready for payment settlement.</div>
              </div>
            </div>
            <a
              href="/payments"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              Go to Payments Queue <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Visual Workflow Stepper */}
        <div className="py-4">
          <h4 className="text-sm font-semibold mb-3">Workflow Lifecycle Pipeline</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {STEPS.map((s, idx) => {
              const status = getStepStatus(s.id, idx);
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className={`p-3 rounded-lg border text-center flex flex-col items-center justify-between transition-all ${
                    status === "completed"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      : status === "active"
                        ? "bg-primary/10 border-primary ring-2 ring-primary/20 text-primary font-semibold"
                        : status === "rejected"
                          ? "bg-rose-500/10 border-rose-500/20 text-rose-600 opacity-60"
                          : "bg-muted/30 border-muted text-muted-foreground opacity-50"
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1.5" />
                  <div className="text-xs font-semibold leading-tight">{s.label}</div>
                  <div className="text-[10px] opacity-75 mt-1 leading-tight">{s.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Split Allocations (Cost Objects) if present */}
        {allocations.length > 0 && (
          <div className="py-2 border-t">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Cost Object Allocations (COA)
            </h4>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground text-left">
                  <tr>
                    <th className="p-2">Cost Center</th>
                    <th className="p-2">Allocation</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">COA Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allocations.map((alloc) => (
                    <tr key={alloc.id} className="hover:bg-muted/30">
                      <td className="p-2 font-medium">{alloc.costCenter?.code} - {alloc.costCenter?.name}</td>
                      <td className="p-2">{alloc.percentage}%</td>
                      <td className="p-2 font-semibold">₹{alloc.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2">
                        <Badge
                          variant={alloc.status === "APPROVED" ? "success" : "secondary"}
                          className="text-[10px] px-1.5 py-0.5"
                        >
                          {alloc.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Audit Trail & History */}
        <div className="py-2 border-t">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Chronological Audit Trail
          </h4>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No workflow actions recorded yet.</p>
          ) : (
            <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted-foreground/20">
              {history.map((item) => (
                <div key={item.id} className="relative text-xs">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {item.action.replace(/_/g, " ")} ({item.step.replace(/_/g, " ")})
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    By: <strong className="text-foreground">{item.actorName}</strong> ({item.actorRole})
                    {item.delegateName && (
                      <span className="text-primary italic ml-1">
                        [on behalf of {item.delegateName}]
                      </span>
                    )}
                  </div>
                  {item.comment && (
                    <div className="mt-1 p-2 rounded bg-muted/60 text-muted-foreground italic border-l-2 border-primary/50 text-[11px]">
                      &quot;{item.comment}&quot;
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
