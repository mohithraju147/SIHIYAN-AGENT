import React, { useState } from "react";
import {
  useListDispatches,
  useGetDispatchSummary,
  useCreateDispatch,
  useUpdateDispatch,
  useDeleteDispatch,
  useUpdateDispatchStatus,
  getListDispatchesQueryKey,
  getGetDispatchSummaryQueryKey,
  getGetRecentDispatchesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Truck, Search, Plus, Edit2, Trash2, Package } from "lucide-react";

type Dispatch = {
  id: number;
  trackingNumber: string;
  customerName: string;
  customerPhone?: string | null;
  destination: string;
  status: string;
  items: string;
  totalWeight?: string | null;
  totalValue?: string | null;
  dispatchDate?: string | null;
  expectedDelivery?: string | null;
  deliveredAt?: string | null;
  notes?: string | null;
  driver?: string | null;
  vehicle?: string | null;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400",
  in_transit: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400",
};

const emptyForm = {
  customerName: "",
  customerPhone: "",
  destination: "",
  items: "",
  totalWeight: "",
  totalValue: "",
  dispatchDate: "",
  expectedDelivery: "",
  notes: "",
  driver: "",
  vehicle: "",
  status: "pending",
};

export default function Dispatch() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Dispatch | null>(null);
  const [statusItem, setStatusItem] = useState<Dispatch | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [form, setForm] = useState(emptyForm);

  const params = {
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  };

  const { data: dispatches = [], isLoading } = useListDispatches(params);
  const { data: summary } = useGetDispatchSummary();

  const createMutation = useCreateDispatch();
  const updateMutation = useUpdateDispatch();
  const deleteMutation = useDeleteDispatch();
  const statusMutation = useUpdateDispatchStatus();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListDispatchesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDispatchSummaryQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRecentDispatchesQueryKey() });
  };

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: Dispatch) => {
    setEditItem(item);
    setForm({
      customerName: item.customerName,
      customerPhone: item.customerPhone ?? "",
      destination: item.destination,
      items: item.items,
      totalWeight: String(item.totalWeight ?? ""),
      totalValue: String(item.totalValue ?? ""),
      dispatchDate: item.dispatchDate ? new Date(item.dispatchDate).toISOString().slice(0, 16) : "",
      expectedDelivery: item.expectedDelivery ? new Date(item.expectedDelivery).toISOString().slice(0, 16) : "",
      notes: item.notes ?? "",
      driver: item.driver ?? "",
      vehicle: item.vehicle ?? "",
      status: item.status,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const data = {
      customerName: form.customerName,
      customerPhone: form.customerPhone || null,
      destination: form.destination,
      items: form.items,
      totalWeight: form.totalWeight ? parseFloat(form.totalWeight) : null,
      totalValue: form.totalValue ? parseFloat(form.totalValue) : null,
      dispatchDate: form.dispatchDate ? new Date(form.dispatchDate).toISOString() : null,
      expectedDelivery: form.expectedDelivery ? new Date(form.expectedDelivery).toISOString() : null,
      notes: form.notes || null,
      driver: form.driver || null,
      vehicle: form.vehicle || null,
      status: form.status,
    };

    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data },
        {
          onSuccess: () => { toast({ title: "Dispatch updated" }); setDialogOpen(false); invalidate(); },
          onError: () => toast({ title: "Update failed", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { data },
        {
          onSuccess: () => { toast({ title: "Dispatch created" }); setDialogOpen(false); invalidate(); },
          onError: () => toast({ title: "Create failed", variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = (item: Dispatch) => {
    if (!confirm(`Delete dispatch ${item.trackingNumber}?`)) return;
    deleteMutation.mutate(
      { id: item.id },
      {
        onSuccess: () => { toast({ title: "Dispatch deleted" }); invalidate(); },
        onError: () => toast({ title: "Delete failed", variant: "destructive" }),
      }
    );
  };

  const handleStatusUpdate = () => {
    if (!statusItem || !newStatus) return;
    statusMutation.mutate(
      { id: statusItem.id, data: { status: newStatus } },
      {
        onSuccess: () => { toast({ title: "Status updated" }); setStatusDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Update failed", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dispatch Tracking</h2>
          <p className="text-muted-foreground mt-1">Monitor and manage seed shipments.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Dispatch
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {[
          { label: "Total", value: summary?.total },
          { label: "Pending", value: summary?.pending, color: "text-amber-600" },
          { label: "In Transit", value: summary?.inTransit, color: "text-blue-600" },
          { label: "Delivered", value: summary?.delivered, color: "text-emerald-600" },
          { label: "Cancelled", value: summary?.cancelled, color: "text-destructive" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${color ?? ""}`}>{value ?? "-"}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tracking, customer, destination..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading dispatches...</div>
          ) : dispatches.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No dispatches found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-2">Tracking #</th>
                    <th className="text-left py-3 px-2">Customer</th>
                    <th className="text-left py-3 px-2">Destination</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-left py-3 px-2">Driver</th>
                    <th className="text-left py-3 px-2">Expected</th>
                    <th className="text-right py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((d) => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-2 font-mono text-xs font-bold">{d.trackingNumber}</td>
                      <td className="py-3 px-2">
                        <div className="font-medium">{d.customerName}</div>
                        {d.customerPhone && <div className="text-xs text-muted-foreground">{d.customerPhone}</div>}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{d.destination}</td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[d.status] ?? ""}`}>
                          {d.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{d.driver ?? "-"}</td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">
                        {d.expectedDelivery ? new Date(d.expectedDelivery).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm" variant="outline"
                            className="text-xs h-7 px-2"
                            onClick={() => { setStatusItem(d); setNewStatus(d.status); setStatusDialogOpen(true); }}
                          >
                            Update Status
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(d)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? `Edit Dispatch — ${editItem.trackingNumber}` : "New Dispatch"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {[
              { key: "customerName", label: "Customer Name *", full: true },
              { key: "customerPhone", label: "Phone" },
              { key: "destination", label: "Destination *" },
              { key: "items", label: "Items Description *", full: true },
              { key: "totalWeight", label: "Total Weight (kg)", type: "number" },
              { key: "totalValue", label: "Total Value (₹)", type: "number" },
              { key: "driver", label: "Driver Name" },
              { key: "vehicle", label: "Vehicle No." },
              { key: "dispatchDate", label: "Dispatch Date", type: "datetime-local" },
              { key: "expectedDelivery", label: "Expected Delivery", type: "datetime-local" },
              { key: "notes", label: "Notes", full: true },
            ].map(({ key, label, full, type }) => (
              <div key={key} className={`space-y-1 ${full ? "col-span-2" : ""}`}>
                <Label>{label}</Label>
                <Input
                  type={type ?? "text"}
                  value={form[key as keyof typeof form] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editItem ? "Save Changes" : "Create Dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status — {statusItem?.trackingNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>New Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusUpdate} disabled={statusMutation.isPending}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
