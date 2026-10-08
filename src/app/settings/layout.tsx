import { ShellLayout } from "@/app/_shell/ShellLayout";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return <ShellLayout>{children}</ShellLayout>;
}
