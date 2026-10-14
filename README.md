# Embed Creator

A universal Discord bot written in TypeScript: one bot — a lot of embeds for each server.
Embeds are JSON files with a select menu and optional buttons.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill it in:

| Variable | Purpose |
|---|---|
| `TOKEN` | Bot token (required) |
| `OWNER_ID` | Your Discord ID (only you can use `/guild-add`, `/guild-remove`, `/guild-list`) |
| `GUILD_ID` | Guild ID for instant command registration; empty - global (can take up to an hour) |
| `ADMIN_ROLE_ID` | Default role for `/embed`; empty - available to everyone |
| `EMBED_FOLDER` | Data folder, defaults to `data` |
| `EMBEDS_RELOAD_USERS` | Comma-separated user IDs allowed to use `/embeds-reload`; empty - everyone |

Privileged gateway intents are not required because the bot works with slash commands only.

3. `npm run build && npm start` (or `npm run dev`).

## Connecting guilds

You don't have to edit `guilds.json` by hand - there are commands (restricted to `OWNER_ID`):

| Command | What it does |
|---|---|
| `/guild-add id:<ID> [folder] [admin_role]` | Connects a guild: creates `data/guilds/<folder>/embeds/`; without `folder` the folder is the ID |
| `/guild-remove id:<ID>` | Disconnects a guild |
| `/guild-list` | List of connected guilds |

`guilds.json` format (if you want to edit it by hand):

```json
{
  "111111111111111111": "myserver",
  "222222222222222222": { "folder": "other", "adminRole": "333333333333333333" }
}
```

## Guild isolation

```
data/
  embeds/                        SHARED pool: visible to all connected guilds
    menu.json
  guilds/
    serverA/embeds/              visible only to serverA
      welcome.json
    serverB/embeds/              visible only to serverB
      rules.json
```

An embed is looked up in its own guild folder first, then in the shared pool. Another guild's folder is never mixed in: guild A cannot open guild B's `welcome`, even knowing the file name.

## Commands

| Command | What it does |
|---|---|
| `/embed name:<name>` | Posts an embed to the current channel (e.g. `name:menu`) |
| `/embeds` | List of available embeds (guild + shared) |
| `/embeds-reload` | Reloads embeds and `guilds.json` without a restart |
| `/guild-add` `/guild-remove` `/guild-list` | Guild management (owner only) |

## JSON format

The file name is the embed name. Basic shape:

```json
{
  "content": null,
  "embed": { "title": "One embed", "description": "...", "color": 2631720 }
}
```

Multiple embeds in one message:

```json
{
  "content": "text above the embed",
  "embeds": [{ "title": "A" }, { "title": "B" }]
}
```

### Navigation: select menu and buttons

An `open:<name>` value opens another embed (ephemeral - only you can see it). Resolution is per-guild: a guild file overrides the shared one, and `open:menu` returns to the menu.

```json
{
  "content": null,
  "embed": { "title": "Menu", "description": "Pick a section" },
  "selects": [
    { "label": "About", "value": "open:about", "description": "What this project is" }
  ],
  "buttons": [
    { "label": "Website", "style": "link", "url": "https://...", "emoji": "🌐" },
    { "label": "About", "style": "primary", "value": "open:about" },
    { "label": "← Menu", "style": "secondary", "value": "open:menu" }
  ]
}
```

- `selects` - all options go into a single select menu row, up to 25 options
- `buttons` - `style`: `primary`/`secondary`/`success`/`danger`/`link`; `link` requires `url`, the rest run `value` (e.g. `open:about`); up to 5 buttons per row, rows go under the select menu

### Embed fields

`title`, `description`, `color`, `fields` (`name`/`value`/`inline`), `author`, `footer`, `image`, `thumbnail`, `timestamp`.