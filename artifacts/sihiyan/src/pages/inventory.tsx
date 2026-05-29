import React, { useState } from "react";
import {
  useListInventoryItems,
  useListWarehouses,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useCreateWarehouse,
  useListStockItems,
  getListInventoryItemsQueryKey,
  getListWarehousesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Edit2, Trash2, Search, Warehouse } from "lucide-react";

const emptyItemForm = {
  stockItemId: "",
  warehouseId: "",
  quantity: "0",
  batchNumber: "",
  expiryDate: "",
  notes: "",
};

const emptyWarehouseForm = {
  name: "",
  location: "",
  capacity: "",
  notes: "",
};

export default function Inventory() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ id: number } | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [warehouseForm, setWarehouseForm] = useState(emptyWarehouseForm);

  const inventoryParams = {
    warehouseId: warehouseFilter !== "all" ? parseInt(warehouseFilter) : undefined,
    search: search || undefined,
  };

  const { data: inventoryItems = [], isLoading } = useListInventoryItems(inventoryParams);
  const { data: warehouses = [] } = useListWarehouses();
  const { data: stockItems = [] } = useListStockItems();

  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const createWarehouse = useCreateWarehouse();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
    qc.invalidateQueries({ queryKey: getListWarehousesQueryKey() });
  };

  const openCreate = () => {
    setEditItem(null);
    setItemForm(emptyItemForm);
    setItemDialogOpen(true);
  };

  const openEdit = (item: typeof inventoryItems[number]) => {
    setEditItem({ id: item.id });
    setItemForm({
      stockItemId: String(item.stockItemId),
      warehouseId: String(item.warehouseId),
      quantity: String(item.quantity),
      batchNumber: item.batchNumber ?? "",
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : "",
      notes: item.notes ?? "",
    });
    setItemDialogOpen(true);
  };

  const handleSaveItem = () => {
    const data = {
      stockItemId: parseInt(itemForm.stockItemId),
      warehouseId: parseInt(itemForm.warehouseId),
      quantity: parseFloat(itemForm.quantity) || 0,
      batchNumber: itemForm.batchNumber || null,
      expiryDate: itemForm.expiryDate ? new Date(itemForm.expiryDate).toISOString() : null,
      notes: itemForm.notes || null,
    };

    if (editItem) {
      updateItem.mutate(
        { id: editItem.id, data },
        {
          onSuccess: () => { toast({ title: "Record updated" }); setItemDialogOpen(false); invalidate(); },
          onError: () => toast({ title: "Update failed", variant: "destructive" }),
        }
      );
    } else {
      createItem.mutate(
        { data },
        {
          onSuccess: () => { toast({ title: "Record created" }); setItemDialogOpen(false); invalidate(); },
          onError: () => toast({ title: "Create failed", variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this inventory record?")) return;
    deleteItem.mutate(
      { id },
      {
        onSuccess: () => { toast({ title: "Record deleted" }); invalidate(); },
        onError: () => toast({ title: "Delete failed", variant: "destructive" }),
      }
    );
  };

  const handleSaveWarehouse = () => {
    createWarehouse.mutate(
      {
        data: {
          name: warehouseForm.name,
          location: warehouseForm.location,
          capacity: warehouseForm.capacity ? parseFloat(warehouseForm.capacity) : null,
          notes: warehouseForm.notes || null,
        }
      },
      {
        onSuccess: () => { toast({ title: "Warehouse created" }); setWarehouseDialogOpen(false); invalidate(); },
        onError: () => toast({ title: "Create failed", variant: "destructive" }),
      }
    );
  };

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const exp = new Date(expiryDate);
    const now = new Date();
    const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays < 90 && diffDays > 0;
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventory Management</h2>
          <p className="text-muted-foreground mt-1">Track stock across all warehouse locations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWarehouseDialogOpen(true)} className="gap-2">
            <Warehouse className="h-4 w-4" /> Add Warehouse
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Record
          </Button>
        </div>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory Records</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses ({warehouses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by item name, warehouse, batch..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Loading inventory...</div>
              ) : inventoryItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No inventory records found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="text-left py-3 px-2">Stock Item</th>
                        <th className="text-left py-3 px-2">Warehouse</th>
                        <th className="text-right py-3 px-2">Quantity</th>
                        <th className="text-left py-3 px-2">Batch</th>
                        <th className="text-left py-3 px-2">Expiry</th>
                        <th className="text-right py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryItems.map((item) => (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-2 font-medium">{item.stockItemName ?? `ID:${item.stockItemId}`}</td>
                          <td className="py-3 px-2 text-muted-foreground">{item.warehouseName ?? `ID:${item.warehouseId}`}</td>
                          <td className="py-3 px-2 text-right font-mono font-bold">
                            {parseFloat(String(item.quantity)).toLocaleString()}
                          </td>
                          <td className="py-3 px-2">
                            {item.batchNumber ? (
                              <Badge variant="outline" className="font-mono text-xs">{item.batchNumber}</Badge>
                            ) : "-"}
                          </td>
                          <td className="py-3 px-2">
                            {item.expiryDate ? (
                              <span className={`text-xs font-medium ${
                                isExpired(item.expiryDate) ? "text-destructive" :
                                isExpiringSoon(item.expiryDate) ? "text-amber-600" :
                                "text-muted-foreground"
                              }`}>
                                {new Date(item.expiryDate).toLocaleDateString()}
                                {isExpired(item.expiryDate) && " (expired)"}
                                {isExpiringSoon(item.expiryDate) && !isExpired(item.expiryDate) && " (soon)"}
                              </span>
                            ) : "-"}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} className="text-destructive hover:text-destructive">
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
        </TabsContent>

        <TabsContent value="warehouses">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
            {warehouses.map((w) => (
              <Card key={w.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Warehouse className="h-5 w-5 text-primary" />
                    {w.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium">{w.location}</span>
                  </div>
                  {w.capacity && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="font-medium font-mono">{parseFloat(String(w.capacity)).toLocaleString()} kg</span>
                    </div>
                  )}
                  {w.notes && (
                    <p className="text-muted-foreground text-xs mt-2">{w.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Inventory Record" : "Add Inventory Record"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Stock Item *</Label>
              <Select value={itemForm.stockItemId} onValueChange={(v) => setItemForm((f) => ({ ...f, stockItemId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stock item" />
                </SelectTrigger>
                <SelectContent>
                  {stockItems.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Warehouse *</Label>
              <Select value={itemForm.warehouseId} onValueChange={(v) => setItemForm((f) => ({ ...f, warehouseId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {[
              { key: "quantity", label: "Quantity *", type: "number" },
              { key: "batchNumber", label: "Batch Number" },
              { key: "expiryDate", label: "Expiry Date", type: "date" },
              { key: "notes", label: "Notes" },
            ].map(({ key, label, type }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  type={type ?? "text"}
                  value={itemForm[key as keyof typeof itemForm] ?? ""}
                  onChange={(e) => setItemForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveItem} disabled={createItem.isPending || updateItem.isPending}>
              {editItem ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={warehouseDialogOpen} onOpenChange={setWarehouseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Warehouse</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { key: "name", label: "Warehouse Name *" },
              { key: "location", label: "Location *" },
              { key: "capacity", label: "Capacity (kg)", type: "number" },
              { key: "notes", label: "Notes" },
            ].map(({ key, label, type }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  type={type ?? "text"}
                  value={warehouseForm[key as keyof typeof warehouseForm] ?? ""}
                  onChange={(e) => setWarehouseForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarehouseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveWarehouse} disabled={createWarehouse.isPending}>Create Warehouse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
