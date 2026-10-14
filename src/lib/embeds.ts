import { EmbedBuilder } from "discord.js";
import fs from "node:fs";
import path from "node:path";

export interface SelectOption {
  label?: string;
  value?: string;
  description?: string;
}

export interface ButtonSpec {
  label?: string;
  style?: "primary" | "secondary" | "success" | "danger" | "link";
  url?: string;
  value?: string;
  emoji?: string;
}

export interface EmbedData {
  embed?: Record<string, unknown>;
  embeds?: Record<string, unknown>[];
  content?: string | null;
  selects?: SelectOption[];
  buttons?: ButtonSpec[];
}

export function loadEmbedsDir(base: string): Record<string, EmbedData> {
  const result: Record<string, EmbedData> = {};
  if (!fs.existsSync(base)) return result;

  for (const file of fs.readdirSync(base)) {
    if (!file.endsWith(".json")) continue;
    const stem = file.replace(/\.json$/, "");
    try {
      const text = fs.readFileSync(path.join(base, file), "utf-8").replace(/^\uFEFF/, "");
      const data = JSON.parse(text);
      if (data && typeof data === "object" && Array.isArray(data.embeds) && !data.embed) {
        const embedsList = (data.embeds as Record<string, unknown>[]) || [];
        result[stem] = {
          embeds: embedsList,
          embed: embedsList[0] || {},
          content: data.content ?? "",
          selects: data.selects || [],
          buttons: data.buttons || [],
        };
      } else {
        result[stem] = data as EmbedData;
      }
    } catch (e) {
      console.warn(`Не вдалося завантажити ембед ${file}:`, e);
    }
  }
  return result;
}

export function jsonToEmbed(d: Record<string, unknown> | undefined): EmbedBuilder {
  const e = new EmbedBuilder();
  if (!d) return e;
  if (d.title) e.setTitle(String(d.title));
  if (d.description) e.setDescription(String(d.description));
  if (d.color !== undefined && d.color !== null) {
    try {
      e.setColor(Number(d.color));
    } catch {}
  }
  if (Array.isArray(d.fields)) {
    for (const f of d.fields as Record<string, unknown>[]) {
      e.addFields({
        name: String(f.name ?? ""),
        value: String(f.value ?? ""),
        inline: Boolean(f.inline),
      });
    }
  }
  if (d.author && typeof d.author === "object") {
    const author = d.author as Record<string, unknown>;
    if (author.name) {
      e.setAuthor({
        name: String(author.name),
        ...(author.icon_url ? { iconURL: String(author.icon_url) } : {}),
        ...(author.url ? { url: String(author.url) } : {}),
      });
    }
  }
  if (d.footer && typeof d.footer === "object") {
    const footer = d.footer as Record<string, unknown>;
    if (footer.text) {
      e.setFooter({
        text: String(footer.text),
        ...(footer.icon_url ? { iconURL: String(footer.icon_url) } : {}),
      });
    }
  }
  const image = (
    d.image && typeof d.image === "object" ? (d.image as Record<string, unknown>).url : d.image
  ) as string | undefined;
  if (image) e.setImage(image);
  const thumb = (
    d.thumbnail && typeof d.thumbnail === "object"
      ? (d.thumbnail as Record<string, unknown>).url
      : d.thumbnail
  ) as string | undefined;
  if (thumb) e.setThumbnail(thumb);
  if (d.timestamp) e.setTimestamp(new Date(String(d.timestamp)));
  return e;
}
