"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, BookOpen, Play, Download } from "lucide-react";

const actions = [
  {
    label: "Upload Statement",
    description: "Upload a new bank statement PDF",
    href: "/upload",
    icon: Upload,
    color: "text-blue-600",
    bg: "bg-blue-50 hover:bg-blue-100",
  },
  {
    label: "Import Chart of Accounts",
    description: "Import QBO accounts from CSV",
    href: "/chart-of-accounts",
    icon: BookOpen,
    color: "text-emerald-600",
    bg: "bg-emerald-50 hover:bg-emerald-100",
  },
  {
    label: "Apply Rules",
    description: "Auto-categorize transactions with rules",
    href: "/rules",
    icon: Play,
    color: "text-purple-600",
    bg: "bg-purple-50 hover:bg-purple-100",
  },
  {
    label: "Export CSV",
    description: "Generate QuickBooks-ready export",
    href: "/export",
    icon: Download,
    color: "text-orange-600",
    bg: "bg-orange-50 hover:bg-orange-100",
  },
];

export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => (
        <Link key={action.href} href={action.href}>
          <Card className={`cursor-pointer transition-colors ${action.bg}`}>
            <CardContent className="flex items-center gap-3 p-4">
              <action.icon className={`h-8 w-8 ${action.color}`} />
              <div>
                <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                <p className="text-xs text-gray-500">{action.description}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
