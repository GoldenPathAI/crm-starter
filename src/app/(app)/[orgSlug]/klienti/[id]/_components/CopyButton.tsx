"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/app/_ui/Toast";
import { cn } from "@/lib/cn";

interface CopyButtonProps {
  value: string;
  label: string;
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        variant: "error",
        title: "Hodnotu se nepodařilo zkopírovat",
        description: "Označ ji a zkopíruj ručně.",
      });
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex size-6 shrink-0 items-center justify-center rounded-full text-muted-soft transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-surface-3/60 hover:text-foreground",
        className,
      )}
    >
      {copied ? <Check className="size-3.5 text-green-text" /> : <Copy className="size-3.5" />}
    </button>
  );
}
