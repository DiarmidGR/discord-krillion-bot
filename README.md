# Krillion Discord Bot

A Discord bot that tracks daily **Krillion** scores and automatically announces the top 3 players.

## Features

* 🎮 Watches a configured Discord channel for Krillion results
* 📅 Tracks scores by calendar day
* 🏆 Announces the top 3 players
* 🔄 Keeps each user's highest score for the day
* 🥇🥈🥉 Breaks ties by who achieved their score first
* 🔢 Ignores results from a different Krillion game number
* 🔁 Backfills channel history once on first start, then the current day on later starts
* 💾 SQLite persistence
* 🐳 Docker support

## Commands

### Configuration

Requires **Manage Server** permission.

```text
!krillion channel #channel
```

### Information

```text
!krillion status
!krillion help
```

## How It Works

Each calendar day is treated as a separate competition period.

The first valid result determines the Krillion game number for that day. Results for other game numbers are ignored.

If a user submits multiple results, only their highest score is kept.

Tied scores are ranked by who achieved the score first.

Around 12 AM ET, the bot posts the day's top 3 and mentions the users directly.

Example:

```text
🏆 Krillion #80 Results

🥇 @Alice — 520
🥈 @Bob — 490
🥉 @Charlie — 450
```

## Setup

### Requirements

* Node.js 22+
* npm
* Discord bot/application
* Message Content Intent enabled
* Read Message History permission in the watched channel

### Install

```bash
git clone https://github.com/DiarmidGR/discord-krillion-bot.git
cd discord-krillion-bot
npm install
```

Create `.env`:

```env
DISCORD_TOKEN=your_discord_bot_token
```

Run in development:

```bash
npm run dev
```

Build and run:

```bash
npm run build
npm start
```

## Docker

Build and start the bot:

```bash
docker compose build
docker compose up -d
```

View logs:

```bash
docker compose logs -f
```

Stop the bot:

```bash
docker compose down
```

The SQLite database is stored in `./data/krillion.db` and mounted into the container, so the database persists when the container is recreated.

## Configuration Example

```text
!krillion channel #krillion-results
```

Check the current configuration with:

```text
!krillion status
```

## Tech Stack

* TypeScript
* Node.js
* discord.js
* SQLite / better-sqlite3
* Luxon
* Docker

## Disclaimer

This README was written with the assistance of AI.

## License

Copyright © 2026 Diarmid Rendell

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for the full license text.
