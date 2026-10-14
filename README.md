# Embed Creator

A Discord bot written in TypeScript that posts embeds from JSON files.
Embeds live in a single folder (`data/embeds/`), all servers see the same set.
Anyone can run their own instance with their own embeds (MIT license).

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill it in:

| Variable | Purpose |
|---|---|
| `TOKEN` | Bot token (required) |
| `OWNER_ID` | Your Discord ID (only you can use `/embeds-reload` if `EMBEDS_RELOAD_USERS` is set) |
| `GUILD_ID` | Guild ID for instant command registration; empty - global (can take up to an hour) |
| `ADMIN_ROLE_ID` | Role allowed to use `/embed`; empty - everyone |
| `EMBED_FOLDER` | Data folder, defaults to `data` |
| `EMBEDS_RELOAD_USERS` | Comma-separated user IDs allowed to use `/embeds-reload`; empty - everyone |

Privileged gateway intents are not required because the bot works with slash commands only.

3. `npm run build && npm start` (or `npm run dev`).

## Embeds

Put your JSON files into `data/embeds/`. The file name (without `.json`) is the embed name.

```
data/
  embeds/
    menu.json
    party.json
    rules.json
```

## Commands

| Command | What it does |
|---|---|
| `/embed name:<name>` | Posts an embed to the current channel (e.g. `name:menu`) |
| `/embeds` | List of available embeds |
| `/embeds-reload` | Reloads embeds from files without a restart |

## JSON format

Basic shape:

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

An `open:<name>` value opens another embed (ephemeral - only you can see it).
`open:menu` returns to the menu.

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

## License

MIT
