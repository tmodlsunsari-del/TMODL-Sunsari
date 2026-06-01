import React from "react";
import { CheckCircle2, ShieldAlert, ChevronRight } from "lucide-react";

interface MarkdownViewProps {
  text: string;
}

export default function MarkdownView({ text }: MarkdownViewProps) {
  if (!text) return null;

  // Split into lines for parsing
  const lines = text.split("\n");

  return (
    <div className="space-y-3 font-sans text-sm text-neutral-700 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        // Headers
        if (trimmed.startsWith("###")) {
          return (
            <h4
              key={idx}
              className="text-base font-bold text-emerald-700 mt-5 mb-2 flex items-center gap-2 border-b border-neutral-100 pb-1.5 font-sans"
            >
              <ChevronRight className="w-4 h-4 text-emerald-600 shrink-0" />
              {parseInlineStyles(trimmed.replace(/^###\s*/, ""))}
            </h4>
          );
        }

        if (trimmed.startsWith("##")) {
          return (
            <h3
              key={idx}
              className="text-lg font-bold text-amber-750 mt-6 mb-3 flex items-center gap-2 border-b border-neutral-200 pb-2"
            >
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              {parseInlineStyles(trimmed.replace(/^##\s*/, ""))}
            </h3>
          );
        }

        if (trimmed.startsWith("#")) {
          return (
            <h2
              key={idx}
              className="text-xl font-extrabold text-neutral-900 mt-6 mb-4 pb-2 border-b border-neutral-200"
            >
              {parseInlineStyles(trimmed.replace(/^#\s*/, ""))}
            </h2>
          );
        }

        // Checklist items
        if (/^-\s*\[[xX]\]/.test(trimmed)) {
          return (
            <div key={idx} className="flex items-start gap-2.5 py-1 text-emerald-800/95 font-medium">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{parseInlineStyles(trimmed.replace(/^-\s*\[[xX]\]\s*/, ""))}</span>
            </div>
          );
        }

        if (/^-\s*\[\s*\]/.test(trimmed)) {
          return (
            <div key={idx} className="flex items-start gap-2.5 py-1 text-neutral-600">
              <span className="w-4.5 h-4.5 rounded-full border-2 border-neutral-300 shrink-0 mt-0.5 flex items-center justify-center text-[10px] text-neutral-600 font-bold bg-neutral-50">
                !
              </span>
              <span>{parseInlineStyles(trimmed.replace(/^-\s*\[\s*\]\s*/, ""))}</span>
            </div>
          );
        }

        // Regular bullets
        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          const content = trimmed.replace(/^[-*]\s*/, "");
          return (
            <div key={idx} className="flex items-start gap-2 py-0.5 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2" />
              <span className="flex-1">{parseInlineStyles(content)}</span>
            </div>
          );
        }

        // Enumerated lists
        if (/^\d+\./.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s*(.*)/);
          if (match) {
            const num = match[1];
            const content = match[2];
            return (
              <div key={idx} className="flex items-start gap-3 py-1">
                <span className="font-mono text-emerald-600 font-bold shrink-0">{num}.</span>
                <span className="flex-1">{parseInlineStyles(content)}</span>
              </div>
            );
          }
        }

        // Default paragraph
        return (
          <p key={idx} className="text-neutral-600 leading-relaxed py-0.5">
            {parseInlineStyles(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Super elementary helper to extract bold markers (**text**) and render them as JSX elements.
 */
function parseInlineStyles(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-neutral-900 font-bold underline decoration-neutral-200 decoration-2">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
