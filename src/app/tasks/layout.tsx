import { ShellLayout } from "@/app/_shell/ShellLayout";

export default function TasksLayout({ children }: LayoutProps<"/tasks">) {
  return <ShellLayout>{children}</ShellLayout>;
}
