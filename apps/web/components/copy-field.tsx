"use client";
import { useState } from "react";
export function CopyField({ label, value }: { label: string; value: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="copy-field">
      <span className="eyebrow">{label}</span>
      <code>{value}</code>
      <button
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage("Copied");
          } catch {
            setMessage("Select the identifier to copy manually");
          }
        }}
      >
        Copy {label}
      </button>
      <span role="status">{message}</span>
    </div>
  );
}
