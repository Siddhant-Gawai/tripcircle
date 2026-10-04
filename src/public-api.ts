import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config";
import type { Place, Room } from "./types";
const headers = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  "Content-Type": "application/json",
};
async function read<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers,
    ...init,
  });
  if (!response.ok)
    throw new Error("The catalogue could not refresh. Please try again.");
  return response.json();
}
export const readPlaces = () =>
  read<Place[]>("tripcircle_destinations?select=*&order=position");
export const readRooms = () =>
  read<Room[]>("rpc/tripcircle_rooms", {
    method: "POST",
    body: JSON.stringify({ p_action: "list" }),
  });
