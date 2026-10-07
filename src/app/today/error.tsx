"use client";

import { useEffect } from "react";

import { TodayError } from "@/components/today/TodayError";

export default function TodayErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <TodayError onRetry={retry} />;
}
