/** Small inline icon set for services. Keys are stored in content (service.icon). */
export const ICON_KEYS = [
  "layers",
  "panel",
  "lamp",
  "grid",
  "crown",
  "wrench",
  "window",
  "kitchen",
  "building",
  "sun",
  "shield",
  "door",
  "glass",
  "office",
  "move",
  "sound",
  "wall",
  "sticker",
  "floor",
  "bath",
  "gem",
  "sparkle",
  "star",
  "check",
  "home",
  "ruler",
  "paint",
  "tools",
] as const;
export type IconKey = (typeof ICON_KEYS)[number];

const P: Record<string, string> = {
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  panel: "M4 4h16v16H4zM4 10h16M10 10v10",
  lamp: "M9 21h6M12 17v4M8 3h8l2 9H6l2-9zM6 12h12",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  crown: "M3 18h18l-1-9-5 4-3-7-3 7-5-4zM5 21h14",
  wrench: "M14.7 6.3a4 4 0 0 0-5.3 5.3L3 18l3 3 6.4-6.4a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.1-2.1z",
  window: "M4 3h16v18H4zM12 3v18M4 12h16",
  kitchen: "M3 10h18v11H3zM3 6h18v4H3zM8 14v3M16 14v3",
  building: "M5 21V4h9v17M14 9h5v12M8 8h2M8 12h2M8 16h2M17 12h1M17 16h1",
  sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5 5l-1.5-1.5M19 5l1.5-1.5M5 19l-1.5 1.5M19 19l1.5 1.5M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  shield: "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3zM9 12l2 2 4-4",
  door: "M6 3h12v18H6zM15 12h1",
  glass: "M4 4h16v16H4zM4 12h16M8 4l-2 16M16 4l2 16",
  office: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h2M13 10h2",
  move: "M3 12h18M12 3v18M7 8l-4 4 4 4M17 8l4 4-4 4",
  sound: "M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  wall: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v5M15 10v5M9 15v4",
  sticker: "M5 4h14v10l-4 6H5zM15 20v-6h4",
  floor: "M3 6l9-3 9 3v12l-9 3-9-3zM3 6l9 3 9-3M12 9v12",
  bath: "M4 12h16v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0M8 20l-1 2M16 20l1 2",
  gem: "M6 3h12l4 6-10 12L2 9zM2 9h20M9 3l3 6 3-6M6 9l6 12 6-12",
  sparkle: "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM5 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  check: "M5 12l5 5L20 7",
  home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z",
  ruler: "M3 17L17 3l4 4L7 21zM8 16l2 2M11 13l2 2M14 10l2 2",
  paint: "M4 4h12v5H4zM16 6h3v6H9v7M7 17h4v4H7z",
  tools: "M14 7l3 3-8 8H6v-3zM3 21h18M17 3l4 4",
};

export function Icon({ name, className = "h-6 w-6" }: { name?: string; className?: string }) {
  const d = P[name || ""] || P.star;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
