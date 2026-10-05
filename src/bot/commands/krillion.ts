import {
    ChannelType,
    Message,
    PermissionFlagsBits,
    MessageFlags,
} from "discord.js";

import {
    getGuildConfig,
    setWatchedChannel,
    getPeriodScoreCount,
    getCurrentPeriodLeaderboard,
} from "../../database/database.js";

import {
    ensureCurrentPeriod,
} from "../../krillion/periods.js";

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
        case "leaderboard":
            await handleLeaderboardCommand(message);
            break;

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

        "**Configuration**\n" +
        "`!krillion channel #channel`\n\n" +

        "**Information**\n" +
        "`!krillion status`\n" +
        "`!krillion leaderboard`\n" +
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

    const game =
        period.game_number === null
            ? "Not detected yet"
            : `#${period.game_number}`;

    await message.reply(
        `📊 **Krillion Status**\n\n` +
        `**Channel:** <#${config.channel_id}>\n` +
        `**Current game:** ${game}\n` +
        `**Scores:** ${scoreCount}\n\n`
    );
}

async function handleLeaderboardCommand(
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

    if (period.game_number === null) {
        await message.reply(
            "🏆 **Current Krillion Leaderboard**\n\n" +
            "No Krillion results have been recorded yet."
        );
        return;
    }

    const leaderboard =
        getCurrentPeriodLeaderboard(
            period.id
        );

    if (leaderboard.length === 0) {
        await message.reply(
            `🏆 **Krillion #${period.game_number} Leaderboard**\n\n` +
            "No scores have been recorded yet."
        );
        return;
    }

    const medals = ["🥇", "🥈", "🥉"];

    const lines = leaderboard.map(
        (entry, index) =>
            `${medals[index]} <@${entry.userId}> — **${entry.score}**`
    );

    await message.reply({
        content:
            `🏆 **Krillion #${period.game_number} Leaderboard**\n\n` +
            lines.join("\n"),
        flags: [MessageFlags.SuppressNotifications],// Ensure the leaderboard message doesn't ping users
        allowedMentions: {
            users: leaderboard.map(
                (entry) => entry.userId
            ),
        },
    });
}