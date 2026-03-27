"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal, Workflow, CheckSquare, Key, Cpu, Library, Plug } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const navItems = [
  { label: "Runs", icon: Terminal, href: "/console/runs" },
  { label: "Workflows", icon: Workflow, href: "/console/workflows" },
  { label: "Approvals", icon: CheckSquare, href: "/console/approvals" },
  { label: "Secrets", icon: Key, href: "/console/secrets" },
  { label: "Agents", icon: Cpu, href: "/console/agents" },
  { label: "Skills", icon: Library, href: "/console/skills" },
  { label: "MCP", icon: Plug, href: "/console/mcp" },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[#07090c] text-[#e8ecf4]">
      <div className="flex w-[200px] min-h-0 shrink-0 flex-col border-r border-[#1f2635] bg-[#0a0e16]">
        <div className="px-4 py-6 border-b border-[#1f2635]">
          <div className="font-mono text-xs" style={{ color: "#a9b1c4" }}>
            vela://console
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full justify-start gap-2 font-mono text-xs h-9 ${
                    isActive
                      ? "border-l-2 border-[#52a7ff] text-[#52a7ff] bg-[#52a7ff]/10"
                      : "text-[#a9b1c4] hover:bg-[#1f2635]"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#1f2635] p-3">
          <Select defaultValue="agent-001">
            <SelectTrigger className="border-[#1f2635] bg-[#0f1218] text-[#e8ecf4] font-mono text-xs h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[#1f2635] bg-[#0f1218] text-[#e8ecf4]">
              <SelectItem value="agent-001">Agent 001</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
