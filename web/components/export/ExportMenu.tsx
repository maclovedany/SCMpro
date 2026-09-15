"use client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FORMAT_LABEL, type ExportFormat } from "@/lib/export/sheet";

const FORMATS: ExportFormat[] = ["csv", "xlsx"];

/** 내보내기 드롭다운 — CSV / Excel 공통 (R-UI-05, D-055) */
export function ExportMenu({ onExport, label = "내보내기", variant = "outline", size = "sm", disabled }: {
  onExport: (format: ExportFormat) => void;
  label?: string;
  variant?: "outline" | "link";
  size?: "sm" | "default";
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant={variant} size={size} disabled={disabled} />}>
        <Download className="mr-1 h-4 w-4" />{label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {FORMATS.map(f => (
          <DropdownMenuItem key={f} onClick={() => onExport(f)}>{FORMAT_LABEL[f]}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
