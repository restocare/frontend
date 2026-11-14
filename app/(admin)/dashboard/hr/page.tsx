import { redirect } from "next/navigation";

/** The staff plan's home is the Today board: the page ops open every day. */
export default function HrIndexPage() {
  redirect("/dashboard/hr/today");
}
