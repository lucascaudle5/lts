import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface AccountMenuProps {
  email: string | null;
  signOut: () => Promise<void>;
}

export function AccountMenu({ email, signOut }: AccountMenuProps) {
  return (
    <form action={signOut} className="flex min-w-0 items-center gap-2">
      {email ? (
        <span className="hidden truncate text-sm text-muted-foreground sm:inline" title={email}>
          {email}
        </span>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
        <LogOut aria-hidden />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </form>
  );
}
