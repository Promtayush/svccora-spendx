import { useState } from "react";
import { Button } from "@/components/custom/Button";
import ClaimCard, { Claim } from "@/components/claims/ClaimCard";
import { useExpenses, usePayExpense } from "@/hooks/useExpenses";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { Expense } from "@/hooks/useExpenses";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/custom/Input";
import { IndianRupee, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const toClaim = (expense: Expense): Claim => ({
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
});

const Payments = () => {
  const { t } = useTranslation("payments");
  const { user } = useAuth();
  const approved = useExpenses({ scope: "all", status: "APPROVED" });
  const paid = useExpenses({ scope: "all", status: "PAID" });
  const payExpense = usePayExpense();

  const [payingExpense, setPayingExpense] = useState<Expense | null>(null);
  const [referenceNo, setReferenceNo] = useState("");

  const handleConfirmPayment = () => {
    if (!payingExpense) return;
    payExpense.mutate(
      { id: payingExpense.id, paymentReference: referenceNo.trim() },
      {
        onSuccess: () => {
          setPayingExpense(null);
          setReferenceNo("");
        },
      }
    );
  };

  if (approved.isLoading || paid.isLoading) {
    return <div className="py-12 text-center text-muted-foreground">{t("loading")}</div>;
  }

  if (approved.isError || paid.isError) {
    const error = approved.error || paid.error;
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-destructive">
          {error instanceof Error ? error.message : t("loadError")}
        </p>
        <Button variant="outline" onClick={() => {
          void approved.refetch();
          void paid.refetch();
        }}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("approvedTitle")}</h2>
        {approved.data?.length ? (
          <div className="grid gap-4">
            {approved.data.map((expense) => (
              <ClaimCard
                key={expense.id}
                claim={toClaim(expense)}
                showActions
                role={user?.role.toLowerCase()}
                currentUserId={user?.id}
                onPay={() => {
                  setPayingExpense(expense);
                  setReferenceNo("");
                }}
              />
            ))}
          </div>
        ) : (
          <p className="py-8 text-muted-foreground">{t("approvedEmpty")}</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("paidTitle")}</h2>
        {paid.data?.length ? (
          <div className="grid gap-4">
            {paid.data.map((expense) => (
              <ClaimCard key={expense.id} claim={toClaim(expense)} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-muted-foreground">{t("paidEmpty")}</p>
        )}
      </section>

      {/* Payment Confirmation Modal */}
      <Dialog
        open={Boolean(payingExpense)}
        onOpenChange={(open) => {
          if (!open) {
            setPayingExpense(null);
            setReferenceNo("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-success" />
              Confirm Payment Disbursement
            </DialogTitle>
            <DialogDescription>
              Verify payout parameters before clearing this approved expense report.
            </DialogDescription>
          </DialogHeader>

          {payingExpense && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/60 p-4 space-y-2 border border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payee:</span>
                  <span className="font-semibold text-foreground">
                    {payingExpense.user?.name || payingExpense.user?.email}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium text-foreground">{payingExpense.category}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Settlement Amount:</span>
                  <span className="text-lg font-bold text-success font-mono">
                    ₹{payingExpense.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Transaction / UTR Reference (Optional)
                </label>
                <Input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. UTR12398475 / NEFT-00492"
                  className="mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Recorded in the settlement audit trail for bank reconciliation.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPayingExpense(null);
                setReferenceNo("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="enterprise"
              disabled={payExpense.isPending}
              onClick={handleConfirmPayment}
            >
              {payExpense.isPending ? "Processing..." : "Disburse Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payments;
