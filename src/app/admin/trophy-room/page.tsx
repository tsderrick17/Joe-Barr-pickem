import { redirect } from "next/navigation";

/** The Trophy Room now belongs to every player; the Commissioner's old address leads to it. */
export default function TrophyRoomRedirect() {
  redirect("/trophy-room");
}
