import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import i18n from "@/i18n";

export type UserRole = "EMPLOYEE" | "MANAGER" | "FINANCE" | "ADMIN";

export interface AdminUser {
  id: number;
  name: string | null;
  email: string;
  role: UserRole;
  managerId?: number | null;
  approvalLimit?: number | null;
  canApproveExceptions?: boolean;
  department?: string | null;
  costCenter?: string | null;
  createdAt: string;
  manager?: {
    id: number;
    name: string | null;
    email: string;
    approvalLimit: number | null;
  } | null;
}

export const useUsers = (search: string) =>
  useQuery<AdminUser[], Error>({
    queryKey: ["users", search],
    queryFn: () =>
      apiFetch<AdminUser[]>(
        `/api/users/hierarchy`
      ),
  });

export const useChangeUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation<AdminUser, Error, { id: number; role: UserRole }>({
    mutationFn: ({ id, role }) =>
      apiFetch<AdminUser>(`/api/users/${id}/role`, {
        method: "PATCH",
        body: { role },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["userHierarchy"] });
      toast.success(i18n.t("adminUsers:toast.success"));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

export const useUpdateUserHierarchy = () => {
  const queryClient = useQueryClient();
  return useMutation<
    AdminUser,
    Error,
    { id: number; managerId?: number | null; approvalLimit?: number | null; department?: string; costCenter?: string }
  >({
    mutationFn: ({ id, ...body }) =>
      apiFetch<AdminUser>(`/api/users/${id}/hierarchy`, {
        method: "PATCH",
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["userHierarchy"] });
      toast.success("User hierarchy & signing limit updated.");
    },
    onError: (error) => toast.error(error.message),
  });
};
