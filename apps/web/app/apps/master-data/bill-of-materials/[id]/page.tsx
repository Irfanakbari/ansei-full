/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import { useParams } from "next/navigation";
import RevisionDetails from "../_components/RevisionDetails";
export default function RevisionPage() {
  const { id } = useParams<{ id: string }>();
  return <RevisionDetails id={id} />;
}
