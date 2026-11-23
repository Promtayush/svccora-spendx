import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import i18n from "@/i18n";

export interface ExpenseAllocation {
  id: number;
  costCenterId: number;
  percentage: number;
  amount: number;
  status: string;
  costCenter?: {
    id: number;
    code: string;
    name: string;
  };
}

export interface WorkflowHistoryItem {
  id: number;
  step: string;
  action: string;
  actorId: number;
  actorName: string;
  actorRole: string;
  delegateName?: string | null;
  comment?: string | null;
  createdAt: string;
}

export interface Expense {
  id: number;
  amount: number;
  description: string;
  category: string;
  categoryCode?: string | null;
  paymentMethod?: string;
  status: string;
  date: string;
  userId: number;
  // SVCORA_SpendX Workflow State
  approvalStatus?: string;
  paymentStatus?: string;
  currentStep?: string;
  currentApproverId?: number | null;
  costCenterCode?: string | null;
  receiptUrl?: string | null;
  user: {
    id: number;
    name: string | null;
    email: string;
    department?: string | null;
    costCenter?: string | null;
    manager?: {
      id: number;
      name: string | null;
      email: string;
      approvalLimit?: number | null;
    } | null;
  };
  currentApprover?: {
    id: number;
    name: string | null;
    email: string;
    approvalLimit: number | null;
    role: string;
  } | null;
  reviewer: {
    id: number;
    name: string | null;
    email?: string;
  } | null;
  payer: {
    id: number;
    name: string | null;
    email?: string;
  } | null;
  reviewedById: number | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  paidById: number | null;
  paidAt: string | null;
  paymentReference?: string | null;
  deletedAt?: string | null;
  allocations?: ExpenseAllocation[];
  workflowHistory?: WorkflowHistoryItem[];
}

export interface CostCenter {
  id: number;
  code: string;
  name: string;
  managerId: number | null;
  manager?: {
    id: number;
    name: string | null;
    email: string;
  } | null;
}

export interface UserHierarchyItem {
  id: number;
  name: string | null;
  email: string;
  role: string;
  managerId: number | null;
  approvalLimit: number | null;
  canApproveExceptions: boolean;
  department: string | null;
  costCenter: string | null;
  manager?: {
    id: number;
    name: string | null;
    email: string;
    approvalLimit: number | null;
  } | null;
}

export interface Delegation {
  id: number;
  delegatorId: number;
  delegateId: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  delegator?: { id: number; name: string | null; email: string };
  delegate?: { id: number; name: string | null; email: string };
}

interface ExpenseQueryOptions {
  scope?: "mine" | "all";
  status?: string;
  pendingApproval?: boolean;
  enabled?: boolean;
}

export const useExpenses = ({
  scope = "all",
  status,
  pendingApproval,
  enabled = true,
}: ExpenseQueryOptions = {}) =>
  useQuery<Expense[], Error>({
    queryKey: ["expenses", scope, status || "all", pendingApproval ? "pendingMy" : "allPending"],
    enabled,
    queryFn: () =>
      apiFetch<Expense[]>(
        `/api/expenses?${new URLSearchParams({
          ...(scope ? { scope } : {}),
          ...(status ? { status } : {}),
          ...(pendingApproval ? { pendingApproval: "true" } : {}),
        }).toString()}`
      ),
  });

export const useWorkflowHistory = (expenseId: number | string) =>
  useQuery<WorkflowHistoryItem[], Error>({
    queryKey: ["workflowHistory", expenseId],
    enabled: Boolean(expenseId),
    queryFn: () => apiFetch<WorkflowHistoryItem[]>(`/api/expenses/${expenseId}/history`),
  });

export const useCostCenters = () =>
  useQuery<CostCenter[], Error>({
    queryKey: ["costCenters"],
    queryFn: () => apiFetch<CostCenter[]>("/api/cost-centers"),
  });

export const useUserHierarchy = () =>
  useQuery<UserHierarchyItem[], Error>({
    queryKey: ["userHierarchy"],
    queryFn: () => apiFetch<UserHierarchyItem[]>("/api/users/hierarchy"),
  });

export const useDelegations = () =>
  useQuery<Delegation[], Error>({
    queryKey: ["delegations"],
    queryFn: () => apiFetch<Delegation[]>("/api/delegations"),
  });

export const useCreateDelegation = () => {
  const queryClient = useQueryClient();
  return useMutation<Delegation, Error, { delegateId: number; startDate: string; endDate: string }>({
    mutationFn: (variables) =>
      apiFetch<Delegation>("/api/delegations", {
        method: "POST",
        body: variables,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delegations"] });
      toast.success("Delegation created successfully.");
    },
    onError: (error) => toast.error(error.message),
  });
};

export const useDeleteDelegation = () => {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; message: string }, Error, number>({
    mutationFn: (delegationId) =>
      apiFetch<{ success: boolean; message: string }>(`/api/delegations/${delegationId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delegations"] });
      toast.success("Delegation revoked successfully.");
    },
    onError: (error) => toast.error(error.message),
  });
};

const getId = <TVariables extends string | { id: string | number }>(variables: TVariables) =>
  typeof variables === "string" ? variables : String(variables.id);

export const useSubmitExpense = () => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, string | number>({
    mutationFn: (expenseId) =>
      apiFetch<Expense>(`/api/expenses/${expenseId}/submit`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense report submitted into approval workflow.");
    },
    onError: (error) => toast.error(error.message),
  });
};

export const useApproveExpense = () => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, string | { id: string | number; comment?: string; forwardToUserId?: number }>({
    mutationFn: (variables) => {
      const id = getId(variables);
      const body = typeof variables === "object" ? { comment: variables.comment, forwardToUserId: variables.forwardToUserId } : undefined;
      return apiFetch<Expense>(`/api/expenses/${id}/approve`, {
        method: "PATCH",
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Approval action completed.");
    },
    onError: (error) => toast.error(error.message),
  });
};

export const useRejectExpense = () => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, { id: string | number; comment: string }>({
    mutationFn: (variables) =>
      apiFetch<Expense>(`/api/expenses/${variables.id}/reject`, {
        method: "PATCH",
        body: { comment: variables.comment },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense report sent back to employee.");
    },
    onError: (error) => toast.error(error.message),
  });
};

export const useApproveAndForwardExpense = () => {
  const queryClient = useQueryClient();
  return useMutation<Expense, Error, { id: string | number; forwardToUserId: number; comment?: string }>({
    mutationFn: (variables) =>
      apiFetch<Expense>(`/api/expenses/${variables.id}/approve-and-forward`, {
        method: "PATCH",
        body: { forwardToUserId: variables.forwardToUserId, comment: variables.comment },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense approved and forwarded to ad-hoc reviewer.");
    },
    onError: (error) => toast.error(error.message),
  });
};

export const usePayExpense = () => {
  const queryClient = useQueryClient();
  return useMutation<
    Expense,
    Error,
    string | number | { id: string | number; paymentReference?: string; referenceNo?: string }
  >({
    mutationFn: (variables) => {
      const id = typeof variables === "object" ? variables.id : variables;
      const ref = typeof variables === "object" ? variables.paymentReference || variables.referenceNo : undefined;
      const body = ref ? { paymentReference: ref } : undefined;
      return apiFetch<Expense>(`/api/expenses/${id}/pay`, {
        method: "PATCH",
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Payment disbursed and recorded.");
    },
    onError: (error) => toast.error(error.message),
  });
};

export const useUploadReceipt = () => {
  return useMutation<{ receiptUrl: string }, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("receipt", file);
      return apiFetch<{ receiptUrl: string }>("/api/expenses/upload", {
        method: "POST",
        body: formData,
      });
    },
    onError: (error) => toast.error(error.message),
  });
};

export const useUpdateExpense = () => {
  const queryClient = useQueryClient();
  return useMutation<
    Expense,
    Error,
    {
      id: string | number;
      amount?: number;
      description?: string;
      category?: string;
      date?: string;
      costCenterCode?: string | null;
      receiptUrl?: string | null;
    }
  >({
    mutationFn: ({ id, ...body }) =>
      apiFetch<Expense>(`/api/expenses/${id}`, {
        method: "PUT",
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense report updated successfully.");
    },
    onError: (error) => toast.error(error.message),
  });
};

export interface CategoryMasterItem {
  id: number;
  code: string;
  groupCode: string;
  groupName: string;
  categoryName: string;
  subcategoryName: string;
  receiptRequired: boolean;
  policyLimit: number | null;
  isReimbursable: boolean;
  isStatutory: boolean;
}

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<CategoryMasterItem[]>("/api/categories"),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
};
