import { redirect } from "next/navigation";

export default async function GatePage({
  params,
}: {
  params: Promise<{ gateId: string }>;
}) {
  const { gateId } = await params;

  redirect(`/admin/gates/${gateId}/queue`);
}