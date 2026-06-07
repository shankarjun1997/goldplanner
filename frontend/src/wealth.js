// Shared formatters + label maps for the Gold Wealth OS tabs.

export const fmt = (n) => "₹" + new Intl.NumberFormat("en-IN").format(Math.round(n || 0));

export const fmtGrams = (g) => {
  const n = Number(g || 0);
  return (Number.isInteger(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, "")) + " g";
};

export const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const RELATIONS = [
  { id: "self", label: "Self", emoji: "🧑" },
  { id: "wife", label: "Wife", emoji: "👩" },
  { id: "husband", label: "Husband", emoji: "👨" },
  { id: "daughter", label: "Daughter", emoji: "👧" },
  { id: "son", label: "Son", emoji: "👦" },
  { id: "mother", label: "Mother", emoji: "👵" },
  { id: "father", label: "Father", emoji: "👴" },
  { id: "other", label: "Other", emoji: "👤" },
];
export const relationEmoji = (r) => RELATIONS.find((x) => x.id === r)?.emoji || "👤";

export const ASSET_KINDS = [
  { id: "coin", label: "Coin", emoji: "🪙" },
  { id: "jewellery", label: "Jewellery", emoji: "💍" },
  { id: "bar", label: "Bar", emoji: "🧈" },
  { id: "digital", label: "Digital", emoji: "📱" },
  { id: "chit_maturity", label: "Chit maturity", emoji: "📜" },
];
export const kindEmoji = (k) => ASSET_KINDS.find((x) => x.id === k)?.emoji || "🪙";
export const kindLabel = (k) => ASSET_KINDS.find((x) => x.id === k)?.label || k;

export const OCCASIONS = [
  { id: "wedding", label: "Wedding", emoji: "💍" },
  { id: "birthday", label: "Birthday", emoji: "🎂" },
  { id: "akshaya_tritiya", label: "Akshaya Tritiya", emoji: "🪔" },
  { id: "dhanteras", label: "Dhanteras", emoji: "🏮" },
  { id: "naming", label: "Naming", emoji: "✨" },
  { id: "housewarming", label: "Housewarming", emoji: "🏠" },
  { id: "baby_shower", label: "Baby Shower", emoji: "🍼" },
  { id: "retirement", label: "Retirement", emoji: "🌅" },
  { id: "custom", label: "Custom", emoji: "⭐" },
];
export const occasionEmoji = (o) => OCCASIONS.find((x) => x.id === o)?.emoji || "⭐";
export const occasionLabel = (o) => OCCASIONS.find((x) => x.id === o)?.label || o;
