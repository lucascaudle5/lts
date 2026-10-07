import { RotateCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function TodayError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>Today couldn&rsquo;t load</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>Your data is safe; LTS couldn&rsquo;t reach the database just now.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden />
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
