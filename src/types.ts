export type Photo = {
  file: string;
  caption: string;
  author: string;
  source: string;
  license: string;
  license_url: string;
};
export type Place = {
  id: string;
  name: string;
  landscape: string;
  journey: string;
  duration: string;
  summary: string;
  caveat: string;
  source_url: string;
  itinerary: string;
  details?: {
    photos: Photo[];
    spots: { name: string; summary: string }[];
    stays: { name: string; summary: string; url: string }[];
    gallery_url?: string;
  };
};
export type Day = { title: string; body: string };
export type Room = {
  id: string;
  title: string;
  origin: string;
  summary: string;
  dates: string;
  budget: string;
  capacity: number;
  visibility: "public" | "private";
  members?: number;
  organizer?: boolean;
  status?: string;
  code?: string;
  name?: string;
  plan?: {
    days: Day[];
    notes: string;
    destinations: string[];
    checklist: { id: string; title: string; owner: string; done: boolean }[];
  };
  people?: never;
  posts?: {
    id: string;
    name: string;
    body: string;
    kind: string;
    created_at: string;
    mine: boolean;
  }[];
  votes?: Record<string, number>;
  my_vote?: string | null;
};
export type Member = {
  id: string | null;
  name: string;
  status: string;
  organizer: boolean;
};
export type RoomDetail = Omit<Room, "members"> & { members?: Member[] };
