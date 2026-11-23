import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/custom/Card";
import { Button } from "@/components/custom/Button";
import { Input } from "@/components/custom/Input";
import { Badge } from "@/components/custom/Badge";
import { User, Shield, UserCheck, Calendar, IndianRupee, Plus, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useDelegations,
  useCreateDelegation,
  useDeleteDelegation,
  useUserHierarchy,
} from "@/hooks/useExpenses";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const Settings = () => {
  const { user } = useAuth();
  const { data: delegations = [], isLoading: isDelLoading } = useDelegations();
  const { data: allUsers = [] } = useUserHierarchy();
  const createDelegation = useCreateDelegation();
  const deleteDelegation = useDeleteDelegation();

  const [isDelegationModalOpen, setIsDelegationModalOpen] = useState(false);
  const [delegateId, setDelegateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleCreateDelegation = () => {
    if (!delegateId || !startDate || !endDate) {
      toast.error("Please select a delegate approver and start/end dates.");
      return;
    }

    createDelegation.mutate(
      {
        delegateId: Number(delegateId),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      },
      {
        onSuccess: () => {
          setIsDelegationModalOpen(false);
          setDelegateId("");
          setStartDate("");
          setEndDate("");
        },
      }
    );
  };

  const isApprover = user?.role === "MANAGER" || user?.role === "ADMIN" || user?.role === "FINANCE";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Account & System Settings</h1>
        <p className="text-muted-foreground">
          Manage your enterprise profile, signing authorities, and approver delegations.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              User Profile
            </CardTitle>
            <p className="text-xs text-muted-foreground">Enterprise account credentials & identity</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">Full Name</span>
              <p className="font-medium text-foreground">{user?.name || "Unnamed User"}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">Email Address</span>
              <p className="font-medium text-foreground">{user?.email}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">System Role</span>
              <div className="mt-1">
                <Badge variant="outline" className="font-semibold">
                  {user?.role}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Currency & Organization Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-primary" />
              Finance & Currency Policy
            </CardTitle>
            <p className="text-xs text-muted-foreground">Organizational spend parameters</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">Primary Operating Currency</span>
              <p className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                <span className="text-base font-bold text-primary">₹ INR</span> — Indian Rupee (Default)
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">Workflow Engine</span>
              <p className="font-medium text-foreground">SVCORA_SpendX Multi-Tier Hierarchy</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-muted-foreground">Compliance Checks</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receipt bills required for review. Mandatory comments on report send-back.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approver Delegation (Out of Office) */}
      {isApprover && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                Approver Delegation (Out-of-Office)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Temporarily assign another manager or approver to approve expense claims on your behalf while you are away.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsDelegationModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="w-4 h-4" />
              Add Delegate
            </Button>
          </CardHeader>
          <CardContent>
            {isDelLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Loading delegations...</p>
            ) : delegations.length === 0 ? (
              <div className="py-8 text-center rounded-lg border border-dashed bg-muted/20">
                <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-xs text-muted-foreground font-medium">
                  No active delegations configured. Claims will route to you directly.
                </p>
              </div>
            ) : (
              <div className="divide-y rounded-lg border">
                {delegations.map((d) => (
                  <div key={d.id} className="p-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Delegated To: {d.delegate?.name || d.delegate?.email}
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        Period: {new Date(d.startDate).toLocaleDateString()} — {new Date(d.endDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={d.isActive ? "success" : "secondary"}>
                        {d.isActive ? "Active" : "Expired"}
                      </Badge>
                      {d.delegatorId === user?.id && d.isActive && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleteDelegation.isPending}
                          onClick={() => deleteDelegation.mutate(d.id)}
                          className="h-7 px-2 text-[11px] gap-1"
                          title="Revoke delegation immediately"
                        >
                          <Trash2 className="w-3 h-3" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Delegation Modal */}
      <Dialog open={isDelegationModalOpen} onOpenChange={setIsDelegationModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Out-of-Office Approver Delegate</DialogTitle>
            <DialogDescription>
              Select a colleague who will inherit your signing authority while you are away.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Select Delegate Colleague</label>
              <select
                value={delegateId}
                onChange={(e) => setDelegateId(e.target.value)}
                className="w-full mt-1 rounded-md border border-input bg-background p-2.5 text-sm"
              >
                <option value="">Choose an authorized colleague...</option>
                {allUsers
                  .filter((u) => u.id !== user?.id && u.role !== "EMPLOYEE")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({u.role})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDelegationModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="enterprise"
              onClick={handleCreateDelegation}
              disabled={createDelegation.isPending}
            >
              {createDelegation.isPending ? "Configuring..." : "Enable Delegation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
