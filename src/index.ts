import fs from "node:fs";
import path from "node:path";
import {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  type StringSelectMenuInteraction,
} from "discord.js";
import {
  config,
  reloadGuilds,
} from "./config";
import {
  loadEmbedsDir,
  jsonToEmbed,
  type ButtonSpec,
  type EmbedData,
  type SelectOption,
} from "./lib/embeds";

function log(level: "info" | "warn" | "error", ...args: unknown[]): void {
  const stamp = new Date().toISOString();
  const out = level === "info" ? console.log : level === "warn" ? console.warn : console.error;
  out(`[${stamp}] [${level}]`, ...args);
}

if (!config.token) {
  console.error("TOKEN не задано в .env");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const embedCache = new Map<string, Record<string, EmbedData>>();

function embedsDir(): string {
  return path.join(process.cwd(), config.embedFolder, "embeds");
}

function cached(dir: string): Record<string, EmbedData> {
  let data = embedCache.get(dir);
  if (!data) {
    data = loadEmbedsDir(dir);
    embedCache.set(dir, data);
  }
  return data;
}

function allEmbeds(): Record<string, EmbedData> {
  return cached(embedsDir());
}

function getEmbed(_guildId: string | null | undefined, key: string): EmbedData | undefined {
  return allEmbeds()[key];
}

function listEmbedNames(_guildId: string | null | undefined): string[] {
  return Object.keys(allEmbeds()).sort();
}

function isGuildConnected(_guildId: string | null | undefined): boolean {
  return true;
}

function isGuildMemberRole(member: unknown, roleId: string): boolean {
  if (!member || typeof member !== "object") return false;
  const roles = (member as { roles?: unknown }).roles;
  if (Array.isArray(roles)) return roles.includes(roleId);
  if (roles && typeof roles === "object" && "cache" in roles) {
    const cache = (roles as { cache?: { has?: (id: string) => boolean } }).cache;
    return !!cache?.has && cache.has(roleId);
  }
  return false;
}

function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  const roleId = config.adminRoleId;
  if (!roleId) return true;
  return isGuildMemberRole(interaction.member, roleId);
}

async function replyEphemeral(
  interaction: ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
}

async function requireGuild(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!isGuildConnected(interaction.guildId)) {
    await replyEphemeral(
      interaction,
      "Цей сервер не підключено до системи ембедів.",
    );
    return false;
  }
  return true;
}

function embedSources(data: EmbedData): Record<string, unknown>[] {
  if (data.embeds?.length) return data.embeds;
  if (data.embed) return [data.embed];
  return [];
}

function toBuilders(data: EmbedData): EmbedBuilder[] {
  return embedSources(data)
    .map((src) => jsonToEmbed(src))
    .filter((e) => e.data?.description || e.data?.title);
}

const BUTTON_STYLES: Record<string, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  link: ButtonStyle.Link,
};

function buildButton(spec: ButtonSpec): ButtonBuilder {
  let style = BUTTON_STYLES[(spec.style ?? "secondary").toLowerCase()] ?? ButtonStyle.Secondary;
  if (style === ButtonStyle.Link && !spec.url) style = ButtonStyle.Secondary;
  const btn = new ButtonBuilder().setStyle(style).setLabel(spec.label || "");
  if (style === ButtonStyle.Link) {
    btn.setURL(String(spec.url));
  } else {
    btn.setCustomId(`btn:${spec.value ?? "none"}`);
  }
  if (spec.emoji) btn.setEmoji(spec.emoji);
  return btn;
}

function buildComponents(data: EmbedData) {
  const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];

  const selects = data.selects ?? [];
  if (selects.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("embed_menu")
      .setPlaceholder("Оберіть розділ")
      .setMinValues(1)
      .setMaxValues(1);
    for (const s of selects) {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(s.label || s.value || "")
        .setValue(s.value || s.label || "");
      if (s.description) option.setDescription(s.description);
      menu.addOptions(option);
    }
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }

  const buttons = (data.buttons ?? []).map(buildButton);
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(i, i + 5)),
    );
  }

  return rows;
}

async function sendEmbedData(
  interaction: ChatInputCommandInteraction,
  data: EmbedData,
  successLabel: string,
): Promise<void> {
  const embObjs = toBuilders(data);
  const components = buildComponents(data);
  const content = data.content || undefined;
  const channel = interaction.channel;
  if (!channel || !("send" in channel)) {
    await replyEphemeral(interaction, "Цю команду необхідно використовувати в текстовому каналі.");
    return;
  }
  try {
    await channel.send({ content, embeds: embObjs, components });
  } catch (e) {
    await replyEphemeral(interaction, `Не вдалося надіслати: ${e}`);
    return;
  }
  await replyEphemeral(interaction, successLabel);
}

async function buildOpenPayload(guildId: string | null | undefined, value: string) {
  if (!isGuildConnected(guildId)) {
    return { content: "Цей сервер не підключено до системи ембедів." };
  }
  if (value.startsWith("open:")) {
    const key = value.slice(5);
    const data = getEmbed(guildId, key);
    if (!data) return { content: `Ембед \`${key}\` не знайдено.` };
    const embObjs = toBuilders(data);
    if (embObjs.length > 0) {
      return { content: data.content || undefined, embeds: embObjs };
    }
    return { content: data.content || `Ви обрали: ${key}` };
  }
  return { content: `Ви обрали: ${value}` };
}

async function handleEmbedMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  if (interaction.customId !== "embed_menu") return;
  const value = interaction.values[0] ?? "";
  const msg = interaction.message;

  try {
    await interaction.update({
      content: msg.content || undefined,
      embeds: msg.embeds.map((e) => e.toJSON()),
      components: msg.components.map((c) => c.toJSON()),
    });
  } catch {
    return;
  }

  const payload = await buildOpenPayload(interaction.guildId, value);
  await interaction
    .followUp({ ...payload, flags: MessageFlags.Ephemeral })
    .catch(() => undefined);
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith("btn:")) return;
  const payload = await buildOpenPayload(interaction.guildId, interaction.customId.slice(4));
  await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => undefined);
}

async function cmdEmbed(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  if (!isAdmin(interaction)) {
    await replyEphemeral(interaction, "У вас немає прав на використання цієї команди.");
    return;
  }
  const key = (interaction.options.getString("name") || "").trim();
  const data = getEmbed(interaction.guildId, key);
  if (!data) {
    await replyEphemeral(
      interaction,
      `Ембед \`${key}\` не знайдено. Доступні: ${listEmbedNames(interaction.guildId).join(", ")}`,
    );
    return;
  }
  await sendEmbedData(interaction, data, "✅ Ембед опубліковано в канал.");
}

async function cmdEmbeds(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireGuild(interaction))) return;
  const names = listEmbedNames(interaction.guildId);
  if (names.length === 0) {
    await replyEphemeral(interaction, "Немає доступних ембедів.");
    return;
  }
  await replyEphemeral(interaction, "**Доступні ембеди:**\n" + names.join(", "));
}

async function cmdEmbedsReload(interaction: ChatInputCommandInteraction): Promise<void> {
  if (
    config.embedsReloadUsers.length > 0 &&
    !config.embedsReloadUsers.includes(String(interaction.user.id))
  ) {
    await replyEphemeral(interaction, "У вас немає прав на використання цієї команди.");
    return;
  }
  embedCache.clear();
  reloadGuilds();
  await replyEphemeral(
    interaction,
    "✅ Ембеди перечитано без перезапуску.",
  );
}

const handlers: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
  embed: cmdEmbed,
  embeds: cmdEmbeds,
  "embeds-reload": cmdEmbedsReload,
};

function buildCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return [
    new SlashCommandBuilder()
      .setName("embed")
      .setDescription("Надіслати ембед у цей канал")
      .addStringOption((o) =>
        o.setName("name").setDescription("Назва ембеда").setRequired(true),
      )
      .toJSON(),
    new SlashCommandBuilder().setName("embeds").setDescription("Список доступних ембедів").toJSON(),
    new SlashCommandBuilder()
      .setName("embeds-reload")
      .setDescription("Перезавантажити ембеди з файлів")
      .toJSON(),
  ];
}

async function registerCommands(): Promise<void> {
  if (!client.user) return;
  const rest = new REST().setToken(config.token);
  const body = buildCommands();
  try {
    if (config.guildId) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, config.guildId), { body });
      log("info", "Слеш-команди зареєстровано для сервера", config.guildId);
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body });
      log("info", "Слеш-команди зареєстровано глобально");
    }
  } catch (e) {
    log("error", "Не вдалося зареєструвати команди:", e);
  }
}

client.once(Events.ClientReady, async (c) => {
  log("info", `Бота запущено як ${c.user.tag}`);
  c.user.setPresence({
    activities: [{ name: "Creating embeds", type: ActivityType.Competing }],
    status: "online",
  });
  await registerCommands();
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isStringSelectMenu()) {
      await handleEmbedMenu(interaction);
      return;
    }
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }
    if (interaction.isChatInputCommand()) {
      const handler = handlers[interaction.commandName];
      if (handler) await handler(interaction);
    }
  } catch (e) {
    log("error", "Помилка обробки взаємодії:", e);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: "Сталася непередбачена помилка.", flags: MessageFlags.Ephemeral })
        .catch(() => undefined);
    }
  }
});

client.login(config.token);