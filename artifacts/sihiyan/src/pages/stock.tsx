import React, { useState } from "react";
import {
  useListStockItems,
  useListStockCategories,
  useGetStockSummary,
  useCreateStockItem,
  useUpdateStockItem,
  useDeleteStockItem,
  useAdjustStockQuantity,
  getListStockItemsQueryKey,
  getGetStockSummaryQueryKey,
  getListStockCategoriesQueryKey,
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
import { Package, Search, Plus, Edit2, Trash2, TrendingDown, ArrowUpDown } from "lucide-react";

type StockItem = {
  id: number;
  name: string;
  category: string;
  sku: string;
  quantity: string;
  unit: string;
  minQuantity: string;
  maxQuantity?: string | null;
  unitPrice?: string | null;
  supplier?: string | null;
  location?: string | null;
  notes?: string | null;
};

const emptyForm = {
  name: "",
  category: "",
  sku: "",
  quantity: "0",
  unit: "kg",
  minQuantity: "0",
  maxQuantity: "",
  unitPrice: "",
  supplier: "",
  location: "",
  notes: "",
};

export default function Stock() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [form, setForm] = useState(emptyForm);

  const params = {
    search: search || undefined,
    category: category !== "all" ? category : undefined,
    lowStock: lowStockOnly || undefined,
  };

  const { data: items = [], isLoading } = useListStockItems(params);
  const { data: categories = [] } = useListStockCategories();
  const { data: summary } = useGetStockSummary();

  const createMutation = useCreateStockItem();
  const updateMutation = useUpdateStockItem();
  const deleteMutation = useDeleteStockItem();
  const adjustMutation = useAdjustStockQuantity();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListStockItemsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetStockSummaryQueryKey() });
    qc.invalidateQueries({ queryKey: getListStockCategoriesQueryKey() });
  };

  const isLow = (item: StockItem) =>
    parseFloat(String(item.quantity)) <= parseFloat(String(item.minQuantity));

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: StockItem) => {
    setEditItem(item);
    setForm({
      name: item.name,
      category: item.category,
      sku: item.sku,
      quantity: String(item.quantity),
      unit: item.unit,
      minQuantity: String(item.minQuantity),
      maxQuantity: String(item.maxQuantity ?? ""),
      unitPrice: String(item.unitPrice ?? ""),
      supplier: item.supplier ?? "",
      location: item.location ?? "",
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const data = {
      name: form.name,
      category: form.category,
      sku: form.sku,
      quantity: parseFloat(form.quantity) || 0,
      unit: form.unit,
      minQuantity: parseFloat(form.minQuantity) || 0,
      maxQuantity: form.maxQuantity ? parseFloat(form.maxQuantity) : null,
      unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : null,
      supplier: form.supplier || null,
      location: form.location || null,
      notes: form.notes || null,
    };

    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data },
        {
          onSuccess: () => {
            toast({ title: "Stock item updated" });
            setDialogOpen(false);
            invalidate();
          },
          onError: () => toast({ title: "Update failed", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { data },
        {
          onSuccess: () => {
            toast({ title: "Stock item created" });
            setDialogOpen(false);
            invalidate();
          },
          onError: () => toast({ title: "Create failed", variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = (item: StockItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    deleteMutation.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          toast({ title: "Stock item deleted" });
          invalidate();
        },
        onError: () => toast({ title: "Delete failed", variant: "destructive" }),
      }
    );
  };

  const handleAdjust = () => {
    if (!adjustItem) return;
    const delta = parseFloat(adjustDelta);
    if (isNaN(delta)) return;

    adjustMutation.mutate(
      { id: adjustItem.id, data: { delta, reason: "Manual adjustment" } },
      {
        onSuccess: () => {
          toast({ title: "Quantity adjusted" });
          setAdjustDialogOpen(false);
          setAdjustDelta("");
          invalidate();
        },
        onError: () => toast({ title: "Adjustment failed", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Stock Management</h2>
          <p className="text-muted-foreground mt-1">Manage seed varieties and inventory levels.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Stock Item
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total Items", value: summary?.totalItems, icon: Package },
          { label: "Low Stock Alerts", value: summary?.lowStockCount, icon: TrendingDown, danger: true },
          { label: "Out of Stock", value: summary?.outOfStockCount, icon: TrendingDown, danger: true },
          { label: "Categories", value: summary?.categoriesCount, icon: ArrowUpDown },
        ].map(({ label, value, icon: Icon, danger }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className={`text-sm font-medium ${danger ? "text-destructive" : ""}`}>{label}</CardTitle>
              <Icon className={`h-4 w-4 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${danger && value ? "text-destructive" : ""}`}>{value ?? "-"}</div>
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
                placeholder="Search items, SKU, supplier..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.category} value={c.category}>{c.category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={lowStockOnly ? "default" : "outline"}
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className="gap-2"
            >
              <TrendingDown className="h-4 w-4" /> Low Stock
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading stock items...</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No stock items found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-2">Name</th>
                    <th className="text-left py-3 px-2">SKU</th>
                    <th className="text-left py-3 px-2">Category</th>
                    <th className="text-right py-3 px-2">Quantity</th>
                    <th className="text-left py-3 px-2">Unit</th>
                    <th className="text-left py-3 px-2">Location</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-right py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isLow(item) ? "bg-destructive/5" : ""}`}
                    >
                      <td className="py-3 px-2 font-medium">{item.name}</td>
                      <td className="py-3 px-2 font-mono text-xs text-muted-foreground">{item.sku}</td>
                      <td className="py-3 px-2">
                        <Badge variant="secondary">{item.category}</Badge>
                      </td>
                      <td className={`py-3 px-2 text-right font-mono font-bold ${isLow(item) ? "text-destructive" : ""}`}>
                        {parseFloat(String(item.quantity)).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">{item.unit}</td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">{item.location ?? "-"}</td>
                      <td className="py-3 px-2">
                        {isLow(item) ? (
                          <Badge variant="destructive">Low Stock</Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-600">OK</Badge>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => { setAdjustItem(item); setAdjustDialogOpen(true); }}
                            title="Adjust quantity"
                          >
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(item)} className="text-destructive hover:text-destructive">
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
            <DialogTitle>{editItem ? "Edit Stock Item" : "Add Stock Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {[
              { key: "name", label: "Name *", full: true },
              { key: "sku", label: "SKU *" },
              { key: "category", label: "Category *" },
              { key: "quantity", label: "Quantity *", type: "number" },
              { key: "unit", label: "Unit *" },
              { key: "minQuantity", label: "Min Quantity *", type: "number" },
              { key: "maxQuantity", label: "Max Quantity", type: "number" },
              { key: "unitPrice", label: "Unit Price (₹)", type: "number" },
              { key: "supplier", label: "Supplier", full: true },
              { key: "location", label: "Location", full: true },
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
              {editItem ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Quantity — {adjustItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Current: <span className="font-bold text-foreground">{adjustItem ? parseFloat(String(adjustItem.quantity)).toLocaleString() : 0} {adjustItem?.unit}</span>
            </p>
            <div className="space-y-1">
              <Label>Delta (use negative to reduce)</Label>
              <Input
                type="number"
                placeholder="e.g. +100 or -50"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={adjustMutation.isPending}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
