import React, { useState } from "react";
import {
  useListDailyReports,
  useGetDailyReport,
  useGenerateDailyReport,
  getListDailyReportsQueryKey,
  getGetDailyReportQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Sparkles, Loader2, ChevronRight, Package, Truck, Star, Send } from "lucide-react";

export default function Reports() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sendingSlack, setSendingSlack] = useState(false);

  const { data: reports = [], isLoading } = useListDailyReports();
  const { data: selectedReport } = useGetDailyReport(
    selectedId!,
    { query: { enabled: !!selectedId, queryKey: getGetDailyReportQueryKey(selectedId!) } }
  );

  const generateMutation = useGenerateDailyReport();

  const handleGenerate = () => {
    generateMutation.mutate(
      {},
      {
        onSuccess: (report) => {
          toast({ title: "Daily report generated & sent to Slack ✓" });
          qc.invalidateQueries({ queryKey: getListDailyReportsQueryKey() });
          setSelectedId(report.id);
        },
        onError: () => toast({ title: "Generation failed", variant: "destructive" }),
      }
    );
  };

  const handleSendSlack = async (id: number) => {
    setSendingSlack(true);
    try {
      const res = await fetch(`/api/reports/daily/${id}/send-slack`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Report sent to Slack ✓" });
      } else {
        toast({ title: "Failed to send to Slack", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to send to Slack", variant: "destructive" });
    } finally {
      setSendingSlack(false);
    }
  };

  const activeReport = selectedId
    ? selectedReport ?? reports.find((r) => r.id === selectedId)
    : reports[reports.length - 1] ?? null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Daily Reports</h2>
          <p className="text-muted-foreground mt-1">AI-generated operations summaries powered by Gemini — auto-posted to Slack.</p>
        </div>
        <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2">
          {generateMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Generate Report</>
          )}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Report List */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Reports ({reports.length})</h3>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Loading...</div>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">No reports yet. Generate your first report.</p>
              </CardContent>
            </Card>
          ) : (
            [...reports].reverse().map((report) => (
              <div
                key={report.id}
                className={`cursor-pointer rounded-lg border p-3 transition-all hover:shadow-sm ${
                  activeReport?.id === report.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
                onClick={() => setSelectedId(report.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{new Date(report.reportDate).toLocaleDateString("en-IN", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(report.reportDate).toLocaleTimeString()}</p>
                  </div>
                  <ChevronRight className={`h-4 w-4 transition-colors ${activeReport?.id === report.id ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{report.summary}</p>
                <Badge variant="outline" className="mt-2 text-xs">{report.generatedBy}</Badge>
              </div>
            ))
          )}
        </div>

        {/* Report Detail */}
        <div className="lg:col-span-2">
          {!activeReport ? (
            <Card className="h-full min-h-[400px]">
              <CardContent className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Generate Your First Report</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Click "Generate Report" to create an AI-powered daily operations summary with stock and dispatch insights.
                </p>
                <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="mt-6 gap-2">
                  {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Now
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>
                        {new Date(activeReport.reportDate).toLocaleDateString("en-IN", {
                          weekday: "long", year: "numeric", month: "long", day: "numeric"
                        })}
                      </CardTitle>
                      <CardDescription className="mt-1">Generated by {activeReport.generatedBy}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={sendingSlack}
                        onClick={() => handleSendSlack(activeReport.id)}
                      >
                        {sendingSlack ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Send to Slack
                      </Button>
                      <Badge className="bg-primary/10 text-primary border-0">
                        <Sparkles className="h-3 w-3 mr-1" /> AI Report
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{activeReport.summary}</p>
                </CardContent>
              </Card>

              {activeReport.stockInsights && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Package className="h-4 w-4 text-emerald-600" />
                      </div>
                      Stock Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{activeReport.stockInsights}</p>
                  </CardContent>
                </Card>
              )}

              {activeReport.dispatchInsights && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Truck className="h-4 w-4 text-blue-600" />
                      </div>
                      Dispatch Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{activeReport.dispatchInsights}</p>
                  </CardContent>
                </Card>
              )}

              {activeReport.recommendations && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Star className="h-4 w-4 text-amber-600" />
                      </div>
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{activeReport.recommendations}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
