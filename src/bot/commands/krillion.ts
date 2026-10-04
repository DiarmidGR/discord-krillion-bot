import {
    ChannelType,
    Message,
    PermissionFlagsBits,
} from "discord.js";

import {
    getGuildConfig,
    setWatchedChannel,
    getPeriodScoreCount,
} from "../../database/database.js";

import {
    ensureCurrentPeriod,
} from "../../krillion/periods.js";

import { DateTime } from "luxon";

const KRILLION_TIMEZONE =
    "America/New_York";

export async function handleKrillionCommand(
    message: Message
): Promise<void> {
    if (!message.guild) {
        return;
    }

    const args = message.content
        .trim()
        .split(/\s+/);

    const subcommand =
        args[1]?.toLowerCase();

    switch (subcommand) {
        case "channel":
            await handleChannelCommand(message);
            break;

        case "status":
            await handleStatusCommand(message);
            break;

        case "help":
            await handleHelpCommand(message);
            break;

        default:
            await handleHelpCommand(message);
            break;
    }
}

async function handleHelpCommand(
    message: Message
): Promise<void> {
    await message.reply(
        "🏆 **Krillion Commands**\n\n" +

        "**Configuration** — Manage Server\n" +
        "`!krillion channel #channel`\n\n" +

        "Winners are announced at the daily Krillion rollover " +
        "(**12:00 AM ET**). This may be a different local time for you.\n\n" +

        "**Information**\n" +
        "`!krillion status`\n" +
        "`!krillion help`"
    );
}

async function handleChannelCommand(
    message: Message
): Promise<void> {
    if (!message.guild) {
        return;
    }

    if (!message.member?.permissions.has(
        PermissionFlagsBits.ManageGuild
    )) {
        await message.reply(
            "You need the **Manage Server** permission to configure Krillion."
        );
        return;
    }

    const channel =
        message.mentions.channels.first();

    if (!channel) {
        await message.reply(
            "Please mention the channel you want me to watch.\n\n" +
            "Example: `!krillion channel #krillion-results`"
        );
        return;
    }

    if (channel.type !== ChannelType.GuildText) {
        await message.reply(
            "I can only watch regular text channels right now."
        );
        return;
    }

    setWatchedChannel(
        message.guild.id,
        channel.id
    );

    await message.reply(
        `I'll now watch ${channel} for Krillion results.`
    );
}

async function handleStatusCommand(
    message: Message
): Promise<void> {
    if (!message.guild) {
        return;
    }

    const config =
        getGuildConfig(
            message.guild.id
        );

    if (!config) {
        await message.reply(
            "Krillion isn't configured yet.\n\n" +
            "Use `!krillion channel #channel` first."
        );
        return;
    }

    const period =
        ensureCurrentPeriod(
            message.guild.id
        );

    if (!period) {
        await message.reply(
            "I couldn't determine the current Krillion period."
        );
        return;
    }

    const scoreCount =
        getPeriodScoreCount(
            period.id
        );

    const periodStart =
        DateTime
            .fromMillis(period.starts_at)
            .setZone(KRILLION_TIMEZONE);

    const periodEnd =
        DateTime
            .fromMillis(period.ends_at)
            .setZone(KRILLION_TIMEZONE);

    const game =
        period.game_number === null
            ? "Not detected yet"
            : `#${period.game_number}`;

    await message.reply(
        `📊 **Krillion Status**\n\n` +
        `**Channel:** <#${config.channel_id}>\n` +
        `**Krillion Time:** ET\n` +
        `**Current game:** ${game}\n` +
        `**Scores:** ${scoreCount}\n\n` +
        `**Current period:**\n` +
        `${periodStart.toFormat("MMM d, yyyy h:mm a")} ET\n` +
        `→ ${periodEnd.toFormat("MMM d, yyyy h:mm a")} ET\n`
    );
}