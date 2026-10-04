import type React from "react";
import type { Photo } from "./types";
const optimizedPhotos = new Set([
  "bordi-beach.jpg",
  "bordi-coast.jpg",
  "don-hills.jpg",
  "guhagar-beach.jpg",
  "guhagar-coast.jpg",
  "jawhar-sunset.jpg",
  "jawhar-valley.jpg",
]);
export const photoCaption = (p: Photo) =>
  p.file.startsWith("don-hills")
    ? "Colourful camping tents on a grassy Don hillside beneath clouds at sunset"
    : p.caption;
export const photo = (p: Photo) =>
  `${import.meta.env.BASE_URL}photos/${optimizedPhotos.has(p.file) ? p.file.replace(".jpg", "-960.webp") : p.file}`;
export const photoSet = (p: Photo) =>
  p.file === "guhagar-coast.jpg"
    ? `${import.meta.env.BASE_URL}photos/guhagar-coast-480.webp 480w, ${import.meta.env.BASE_URL}photos/guhagar-coast-960.webp 600w`
    : optimizedPhotos.has(p.file)
      ? [480, 960, 1280]
          .map(
            (w) =>
              `${import.meta.env.BASE_URL}photos/${p.file.replace(".jpg", `-${w}.webp`)} ${w}w`,
          )
          .join(", ")
      : undefined;
export const maps = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
export function Link({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return (
      <a className="useful-link" href={u.href} target="_blank" rel="noreferrer">
        {children} ↗
      </a>
    );
  } catch {
    return null;
  }
}
export function fields(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}
