import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  Truck,
  Building2,
  BotMessageSquare,
  ScanText,
  FileText,
  Settings,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { VoiceButton } from "@/components/voice-button";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/dispatch", label: "Dispatch", icon: Truck },
  { href: "/inventory", label: "Inventory", icon: Building2 },
  { href: "/ai", label: "AI Assistant", icon: BotMessageSquare },
  { href: "/ocr", label: "OCR Scanner", icon: ScanText },
  { href: "/reports", label: "AI Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-card border-r border-border">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-mono text-sm">SI</span>
          </div>
          SIHIYAN
        </h1>
        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-mono">Operations Platform</p>
      </div>
      <div className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? "text-primary-foreground" : ""}`} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 h-full shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile header & sidebar */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden h-16 border-b border-border bg-card flex items-center px-4 shrink-0 justify-between">
          <div className="flex items-center gap-2 font-bold text-primary">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-mono text-xs">SI</span>
            </div>
            SIHIYAN
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-none">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl h-full">
            {children}
          </div>
        </main>
      </div>

      {/* Global floating voice button */}
      <VoiceButton />
    </div>
  );
}
