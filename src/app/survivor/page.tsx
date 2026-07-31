import { redirect } from "next/navigation";

// Survivor selection now lives beside the matching games on The Slate. Keep
// old bookmarks working without leaving a second editable workflow behind.
export default function SurvivorPage() {
  redirect("/board#slate-matchups");
}
