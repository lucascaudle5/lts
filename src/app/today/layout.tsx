import { ShellLayout } from "@/app/_shell/ShellLayout";

export default function TodayLayout({ children }: LayoutProps<"/today">) {
  return <ShellLayout>{children}</ShellLayout>;
}
