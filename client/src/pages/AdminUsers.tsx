import { useState } from "react";
import { Search, ShieldAlert, Sliders, UserCheck, Layers } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChangeUserRole, useUsers, useUpdateUserHierarchy, type AdminUser, type UserRole } from "@/hooks/useUsers";
import { Button } from "@/components/custom/Button";
import { Input } from "@/components/custom/Input";
import { Badge } from "@/components/custom/Badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";

const roleOptions: { value: UserRole }[] = [
  { value: "EMPLOYEE" },
  { value: "MANAGER" },
  { value: "FINANCE" },
  { value: "ADMIN" },
];

const AdminUsers = () => {
  const { t, i18n } = useTranslation("adminUsers");
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [pendingChange, setPendingChange] = useState<{
    user: AdminUser;
    role: UserRole;
  } | null>(null);

  const [editingHierarchyUser, setEditingHierarchyUser] = useState<AdminUser | null>(null);
  const [managerId, setManagerId] = useState<string>("");
  const [approvalLimit, setApprovalLimit] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [costCenter, setCostCenter] = useState<string>("");

  const { data: users = [], isLoading, isError, error, refetch } = useUsers(search);
  const changeRole = useChangeUserRole();
  const updateHierarchy = useUpdateUserHierarchy();

  const confirmRoleChange = () => {
    if (!pendingChange) return;

    changeRole.mutate(
      { id: pendingChange.user.id, role: pendingChange.role },
      { onSuccess: () => setPendingChange(null) }
    );
  };

  const openHierarchyModal = (user: AdminUser) => {
    setEditingHierarchyUser(user);
    setManagerId(user.managerId ? String(user.managerId) : "");
    setApprovalLimit(user.approvalLimit !== null && user.approvalLimit !== undefined ? String(user.approvalLimit) : "");
    setDepartment(user.department || "");
    setCostCenter(user.costCenter || "");
  };

  const saveHierarchy = () => {
    if (!editingHierarchyUser) return;

    updateHierarchy.mutate(
      {
        id: editingHierarchyUser.id,
        managerId: managerId ? Number(managerId) : null,
        approvalLimit: approvalLimit === "" ? null : Number(approvalLimit),
        department,
        costCenter,
      },
      {
        onSuccess: () => setEditingHierarchyUser(null),
      }
    );
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      u.email.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q)) ||
      (u.costCenter && u.costCenter.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            SVCORA_SpendX Hierarchy & User Administration
          </h1>
          <p className="text-muted-foreground">
            Configure line managers (Reports-To), financial signing thresholds (Approval Limits), and department cost centers.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email, department, or cost center..."
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">{t("loading")}</p>
      ) : isError ? (
        <div className="space-y-4 py-12 text-center">
          <p className="text-destructive">
            {error instanceof Error ? error.message : t("loadError")}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">System Role</th>
                <th className="px-4 py-3 font-medium">Reports To (Manager)</th>
                <th className="px-4 py-3 font-medium">Signing Authority Limit</th>
                <th className="px-4 py-3 font-medium">Department / Cost Center</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((listedUser) => {
                const isCurrentUser = listedUser.id === Number(currentUser?.id);

                return (
                  <tr key={listedUser.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{listedUser.name || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground">{listedUser.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={listedUser.role}
                        disabled={isCurrentUser}
                        title={isCurrentUser ? t("ownRoleTooltip") : undefined}
                        onChange={(event) => {
                          const role = event.target.value as UserRole;
                          if (role !== listedUser.role) {
                            setPendingChange({ user: listedUser, role });
                          }
                        }}
                        className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.value}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {listedUser.manager ? (
                        <span className="font-medium flex items-center gap-1 text-primary">
                          <UserCheck className="w-3.5 h-3.5" />
                          {listedUser.manager.name || listedUser.manager.email}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                          None (Top / Unassigned)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {listedUser.role === "EMPLOYEE" ? (
                        <span className="text-muted-foreground font-mono italic">None (Employee)</span>
                      ) : listedUser.approvalLimit === null || listedUser.approvalLimit === undefined ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px]">
                          Unlimited (C-Suite / Top)
                        </Badge>
                      ) : listedUser.approvalLimit === 0 ? (
                        <span className="text-muted-foreground font-mono">₹0.00 (Review Only)</span>
                      ) : (
                        <span className="font-semibold text-foreground font-mono">
                          ₹{listedUser.approvalLimit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {listedUser.department || listedUser.costCenter ? (
                        <span>
                          {listedUser.department || "General"} {listedUser.costCenter ? `(${listedUser.costCenter})` : ""}
                        </span>
                      ) : (
                        <span className="italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openHierarchyModal(listedUser)}
                        className="text-xs h-8"
                      >
                        <Sliders className="w-3.5 h-3.5 mr-1" />
                        Edit Hierarchy
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Hierarchy & Limits Modal */}
      <Dialog open={Boolean(editingHierarchyUser)} onOpenChange={(open) => !open && setEditingHierarchyUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Approval Hierarchy & Signing Limits</DialogTitle>
            <DialogDescription>
              Assign the direct reporting manager and monetary approval threshold for {editingHierarchyUser?.name || editingHierarchyUser?.email}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Reports To (Default Approver)</label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full mt-1 rounded-md border border-input bg-background p-2.5 text-sm"
              >
                <option value="">No Manager (Top of Hierarchy / Unassigned)</option>
                {users
                  .filter((u) => u.id !== editingHierarchyUser?.id && u.role !== "EMPLOYEE")
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
              <p className="text-[11px] text-muted-foreground mt-1">
                The workflow routes new claims to this manager first for operational 1-Up validation.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Approval Limit (₹ INR)
              </label>
              <Input
                type="number"
                value={approvalLimit}
                onChange={(e) => setApprovalLimit(e.target.value)}
                placeholder="Leave blank for Unlimited signing authority"
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Reports exceeding this amount will automatically trigger an upward hierarchy traversal to an Authorized Approver.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Department</label>
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Engineering, Sales"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Default Cost Center</label>
                <Input
                  value={costCenter}
                  onChange={(e) => setCostCenter(e.target.value)}
                  placeholder="e.g. CC-101"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingHierarchyUser(null)}>
              Cancel
            </Button>
            <Button disabled={updateHierarchy.isPending} onClick={saveHierarchy}>
              Save Hierarchy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Confirmation Alert */}
      <AlertDialog
        open={Boolean(pendingChange)}
        onOpenChange={(open) => {
          if (!open) setPendingChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange &&
                t("dialog.description", {
                  name: pendingChange.user.name || pendingChange.user.email,
                  role: t(`roles.${pendingChange.role}`),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              {t("dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
