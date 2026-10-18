"use client";

import { useState } from "react";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

/** Stable per-mounted-form key so retries of the same submission are deduplicated server-side. */
export function useIdempotencyKey() {
  const [key] = useState(newKey);
  return key;
}
