import React, { useState, useRef, useCallback } from "react";
import {
  useListScannedBills,
  useScanBill,
  getListScannedBillsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ScanText, Upload, FileText, CheckCircle, Loader2, X } from "lucide-react";

export default function OCR() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    rawText: string;
    parsedData: string;
    confidence: number;
  } | null>(null);

  const { data: bills = [] } = useListScannedBills();
  const scanMutation = useScanBill();

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      const b64 = dataUrl.split(",")[1];
      setBase64Image(b64);
      setScanResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleScan = () => {
    if (!base64Image) return;
    scanMutation.mutate(
      { data: { imageBase64: base64Image } },
      {
        onSuccess: (data) => {
          setScanResult(data);
          qc.invalidateQueries({ queryKey: getListScannedBillsQueryKey() });
          toast({ title: "Bill scanned successfully" });
        },
        onError: () => toast({ title: "Scan failed", variant: "destructive" }),
      }
    );
  };

  const clearImage = () => {
    setPreview(null);
    setBase64Image(null);
    setScanResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  let parsedDataObj: Record<string, unknown> = {};
  if (scanResult?.parsedData) {
    try { parsedDataObj = JSON.parse(scanResult.parsedData); } catch {}
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">OCR Bill Scanner</h2>
        <p className="text-muted-foreground mt-1">Upload bills and invoices for AI-powered text extraction.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" /> Upload Document
              </CardTitle>
              <CardDescription>Drag and drop or click to upload a bill or invoice image.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!preview ? (
                <div
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                    dragOver
                      ? "border-primary bg-primary/5 scale-[1.02]"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ScanText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop your bill image here</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP — up to 20MB</p>
                  <Button variant="outline" size="sm" className="mt-4">Browse Files</Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <img
                      src={preview}
                      alt="Uploaded bill"
                      className="w-full max-h-64 object-contain rounded-lg border border-border"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={clearImage}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    className="w-full gap-2"
                    onClick={handleScan}
                    disabled={scanMutation.isPending}
                  >
                    {scanMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Scanning with AI...</>
                    ) : (
                      <><ScanText className="h-4 w-4" /> Scan with AI</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {scanResult ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-500" /> Extracted Data
                    <Badge variant="outline" className="ml-auto text-emerald-600 border-emerald-600">
                      {Math.round(scanResult.confidence * 100)}% confidence
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {parsedDataObj.vendorName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Vendor</span>
                      <span className="font-medium">{String(parsedDataObj.vendorName)}</span>
                    </div>
                  )}
                  {parsedDataObj.billAmount != null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-bold font-mono">₹{Number(parsedDataObj.billAmount).toLocaleString()}</span>
                    </div>
                  )}
                  {parsedDataObj.billDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{String(parsedDataObj.billDate)}</span>
                    </div>
                  )}
                  {parsedDataObj.billType && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="secondary">{String(parsedDataObj.billType)}</Badge>
                    </div>
                  )}
                  {Array.isArray(parsedDataObj.items) && parsedDataObj.items.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Line Items</p>
                      <div className="space-y-1">
                        {(parsedDataObj.items as Record<string, unknown>[]).map((item, i) => (
                          <div key={i} className="flex justify-between text-xs py-1 border-b border-border/50">
                            <span>{String(item.description ?? "")}</span>
                            <span className="font-mono">{item.total != null ? `₹${item.total}` : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Raw Extracted Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-3 max-h-48 overflow-y-auto font-mono">
                    {scanResult.rawText || "No text extracted"}
                  </pre>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="h-full min-h-[300px]">
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-sm">Upload and scan a document to see results here.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Scan History */}
      {bills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scan History</CardTitle>
            <CardDescription>{bills.length} bills scanned</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-2">Vendor</th>
                    <th className="text-left py-3 px-2">Type</th>
                    <th className="text-right py-3 px-2">Amount</th>
                    <th className="text-left py-3 px-2">Date</th>
                    <th className="text-right py-3 px-2">Confidence</th>
                    <th className="text-left py-3 px-2">Scanned At</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-2 font-medium">{bill.vendorName ?? "-"}</td>
                      <td className="py-3 px-2">
                        {bill.billType ? <Badge variant="secondary">{bill.billType}</Badge> : "-"}
                      </td>
                      <td className="py-3 px-2 text-right font-mono">
                        {bill.billAmount != null ? `₹${parseFloat(String(bill.billAmount)).toLocaleString()}` : "-"}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {bill.billDate ? new Date(bill.billDate).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`text-xs font-medium ${
                          parseFloat(String(bill.confidence)) > 0.8 ? "text-emerald-600" :
                          parseFloat(String(bill.confidence)) > 0.5 ? "text-amber-600" : "text-destructive"
                        }`}>
                          {Math.round(parseFloat(String(bill.confidence)) * 100)}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground text-xs">
                        {new Date(bill.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
