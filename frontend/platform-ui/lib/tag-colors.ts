const TAG_COLOR_MAP: Record<string, string> = {
  cve: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  owasp: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  rce: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  xss: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  sqli: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  auth: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  secret: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  api: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  cloud: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  network: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  compliance: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
};

const COLOR_PALETTE = [
  "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
];

export function getTagClassName(tag: string): string {
  if (!tag) return COLOR_PALETTE[0];
  const normalized = tag.toLowerCase().trim();
  if (TAG_COLOR_MAP[normalized]) {
    return TAG_COLOR_MAP[normalized];
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
}
