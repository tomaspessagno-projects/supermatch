import type { Metadata } from "next";
import { TowerGame } from "@/tower/ui/TowerGame";

export const metadata: Metadata = {
  title: "La Torre · Supermatch",
};

export default function TowerPage() {
  return <TowerGame />;
}
