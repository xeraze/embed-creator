import { config as loadDotenv } from "dotenv";
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  loadDotenv({ path: envPath });
}

const tokenEnvPath = path.join(process.cwd(), "token.env");
if (fs.existsSync(tokenEnvPath)) {
  loadDotenv({ path: tokenEnvPath });
}

function csv(key: string): string[] {
  return (process.env[key] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  token: process.env.TOKEN || process.env.DISCORD_TOKEN || "",
  ownerId: process.env.OWNER_ID || "",
  guildId: process.env.GUILD_ID || "",
  adminRoleId: process.env.ADMIN_ROLE_ID || "",
  embedFolder: process.env.EMBED_FOLDER || "data",
  embedsReloadUsers: csv("EMBEDS_RELOAD_USERS"),
} as const;

export interface GuildEntry {
  folder: string;
  adminRole?: string;
}

const GUILDS_PATH = path.join(process.cwd(), "guilds.json");

function readGuilds(): Record<string, GuildEntry> {
  if (!fs.existsSync(GUILDS_PATH)) return {};
  try {
    const text = fs.readFileSync(GUILDS_PATH, "utf-8").replace(/^\uFEFF/, "");
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, GuildEntry> = {};
    for (const [guildId, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!/^\d{15,21}$/.test(guildId)) continue;
      if (typeof value === "string") {
        if (isSafeFolder(value)) out[guildId] = { folder: value };
      } else if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const folder = typeof obj.folder === "string" ? obj.folder : "";
        if (!isSafeFolder(folder)) continue;
        out[guildId] = {
          folder,
          adminRole: typeof obj.adminRole === "string" ? obj.adminRole : undefined,
        };
      }
    }
    return out;
  } catch (e) {
    console.warn("Не вдалося прочитати guilds.json:", e);
    return {};
  }
}

function isSafeFolder(name: string): boolean {
  return (
    name.length > 0 &&
    !name.includes("..") &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

let guilds: Record<string, GuildEntry> = readGuilds();

export function getGuild(guildId: string | null | undefined): GuildEntry | undefined {
  if (!guildId) return undefined;
  return guilds[guildId];
}

export function listGuilds(): string[] {
  return Object.keys(guilds);
}

function saveGuilds(): void {
  const out: Record<string, unknown> = {};
  for (const [guildId, entry] of Object.entries(guilds)) {
    out[guildId] = entry.adminRole
      ? { folder: entry.folder, adminRole: entry.adminRole }
      : entry.folder;
  }
  fs.writeFileSync(GUILDS_PATH, JSON.stringify(out, null, 2) + "\n", "utf-8");
}

export function isSafeFolderName(name: string): boolean {
  return isSafeFolder(name);
}

export function addGuild(guildId: string, entry: GuildEntry): void {
  guilds[guildId] = entry;
  saveGuilds();
}

export function removeGuild(guildId: string): boolean {
  if (!(guildId in guilds)) return false;
  delete guilds[guildId];
  saveGuilds();
  return true;
}

export function reloadGuilds(): Record<string, GuildEntry> {
  guilds = readGuilds();
  return guilds;
}
