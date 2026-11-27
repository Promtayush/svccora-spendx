import React from "react";
import { Expense } from "@/hooks/useExpenses";
import { ClaimListRow, ClaimListRowProps } from "./ClaimListRow";

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

export interface ClaimCardProps {
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

export const ClaimCard: React.FC<ClaimCardProps> = (props) => {
  return <ClaimListRow {...props} />;
};

export default ClaimCard;
