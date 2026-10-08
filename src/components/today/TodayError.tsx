import { RotateCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function TodayError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert role="alert" className="border-l-4 border-l-quiet bg-card p-4">
      <AlertTitle className="font-heading text-lg">Your data is safe.</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>That didn&rsquo;t load. Try again?</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden />
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
