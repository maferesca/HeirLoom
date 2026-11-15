import { notFound } from "next/navigation";
import Journey from "@/components/Journey";

export function generateStaticParams() { return [{ lang: "es" }, { lang: "en" }]; }

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "es" && lang !== "en") notFound();
  return <Journey lang={lang} />;
}
