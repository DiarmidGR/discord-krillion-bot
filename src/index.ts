import "dotenv/config";

import {
    Client,
    GatewayIntentBits,
} from "discord.js";

import { handleKrillionCommand } from "./bot/commands/krillion.js";

import {
    getWatchedChannel,
} from "./database/database.js";

import {
    processKrillionMessage,
} from "./krillion/messages.js";

import { startScheduler } from "./krillion/scheduler.js";

import {
    backfillKrillionMessages,
} from "./krillion/backfill.js";

const token = process.env.DISCORD_TOKEN;

if (!token) {
    throw new Error("DISCORD_TOKEN is not set");
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once("clientReady", async (client) => {
    console.log(
        `Logged in as ${client.user.tag}`
    );

    await backfillKrillionMessages(
        client
    );

    startScheduler(client);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) {
        return;
    }

    if (message.content.toLowerCase().startsWith("!krillion")) {
        await handleKrillionCommand(message);
        return;
    }

    if (!message.guild) {
        return;
    }

    const watchedChannelId =
        getWatchedChannel(
            message.guild.id
        );

    if (!watchedChannelId) {
        return;
    }

    if (
        message.channel.id !==
        watchedChannelId
    ) {
        return;
    }

    processKrillionMessage(message);
});

client.login(token);