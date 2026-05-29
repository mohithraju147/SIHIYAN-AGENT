import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Database, Bot, ScanText, Building2, Bell, Mic, Loader2, Check, Send } from "lucide-react";

const features = [
  { icon: Database, title: "Database", description: "PostgreSQL with Drizzle ORM. All data is persisted with full CRUD operations.", status: "Active" },
  { icon: Bot, title: "AI Assistant", description: "Powered by Google Gemini 2.5 Flash via Replit AI Integrations. Streaming responses enabled.", status: "Active" },
  { icon: ScanText, title: "OCR Scanner", description: "Gemini Vision API for document text extraction and bill parsing.", status: "Active" },
  { icon: Building2, title: "Multi-Warehouse", description: "Track inventory across multiple warehouse locations with expiry tracking.", status: "Active" },
  { icon: Mic, title: "Voice Commands", description: "Browser speech recognition supporting English, Kannada, and Malayalam. Tap the mic button anywhere in the app.", status: "Active" },
  { icon: Bell, title: "Slack Reports", description: "Automated daily AI-powered operations reports sent to your Slack channel every morning at 8 AM IST.", status: "Configurable" },
];

const SCHEDULE_OPTIONS = [
  { value: "30 2 * * *", label: "8:00 AM IST (recommended)" },
  { value: "0 2 * * *", label: "7:30 AM IST" },
  { value: "30 3 * * *", label: "9:00 AM IST" },
  { value: "0 4 * * *", label: "9:30 AM IST" },
  { value: "30 4 * * *", label: "10:00 AM IST" },
];

export default function Settings() {
  const { toast } = useToast();
  const [slackWebhook, setSlackWebhook] = useState("");
  const [scheduleTime, setScheduleTime] = useState("30 2 * * *");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        if (data.slack_webhook) setSlackWebhook(data.slack_webhook);
        if (data.report_schedule) setScheduleTime(data.report_schedule);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slack_webhook: slackWebhook || null, report_schedule: scheduleTime }),
      });
      if (res.ok) {
        toast({ title: "Settings saved", description: "Slack and schedule configuration updated." });
      } else {
        toast({ title: "Save failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSlack = async () => {
    if (!slackWebhook) {
      toast({ title: "Enter a webhook URL first", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      // Save the webhook first so the test uses the latest value
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slack_webhook: slackWebhook }),
      });
      // Generate + send a test report
      const res = await fetch("/api/reports/daily", { method: "POST" });
      if (res.ok) {
        toast({ title: "Test report sent to Slack ✓", description: "Check your Slack channel for the report." });
      } else {
        toast({ title: "Test failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Test failed", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Platform configuration and system information.</p>
      </div>

      {/* Slack Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Bell className="h-4 w-4 text-emerald-600" />
            </div>
            Slack Integration
          </CardTitle>
          <CardDescription>
            Receive automatic daily AI operations reports in your Slack channel every morning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading settings…</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="webhook">Slack Incoming Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook"
                    placeholder="https://hooks.slack.com/services/..."
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={handleTestSlack} disabled={testing || !slackWebhook}>
                    {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Test
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your webhook URL from Slack → Apps → Incoming Webhooks.{" "}
                  <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" className="underline text-primary">Learn more</a>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Daily Report Schedule</Label>
                <Select value={scheduleTime} onValueChange={setScheduleTime}>
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Reports are generated automatically and posted to your Slack channel at this time daily.</p>
              </div>

              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Settings
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Platform Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" /> Platform Information
          </CardTitle>
          <CardDescription>SIHIYAN — SIHI Seeds AI Operations Platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: "Platform", value: "SIHIYAN" },
              { label: "Version", value: "1.0.0" },
              { label: "Organization", value: "SIHI Seeds" },
              { label: "Environment", value: import.meta.env.MODE ?? "development" },
              { label: "API Base", value: "/api" },
              { label: "AI Model", value: "Gemini 2.5 Flash" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium font-mono">{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid gap-4 md:grid-cols-2">
        {features.map(({ icon: Icon, title, description, status }) => (
          <Card key={title}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  {title}
                </div>
                <Badge
                  variant="outline"
                  className={status === "Active" ? "text-emerald-600 border-emerald-600 text-xs" : "text-amber-600 border-amber-600 text-xs"}
                >
                  {status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tech Stack */}
      <Card>
        <CardHeader><CardTitle>Tech Stack</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              "React 19", "TypeScript", "Vite", "Tailwind CSS", "shadcn/ui",
              "Express 5", "Drizzle ORM", "PostgreSQL", "Google Gemini API",
              "TanStack Query", "Zod", "OpenAPI", "pnpm Workspaces", "node-cron",
              "Web Speech API", "Slack Webhooks",
            ].map((tech) => (
              <Badge key={tech} variant="secondary">{tech}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
