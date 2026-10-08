import { redirect } from "next/navigation";

/** The proxy already routes `/`; this covers requests it does not run for. */
export default function Home() {
  redirect("/today");
}
