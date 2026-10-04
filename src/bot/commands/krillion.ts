import {
    ChannelType,
    Message,
    PermissionFlagsBits,
} from "discord.js";

import {
    getGuildConfig,
    setAnnouncementTime,
    setTimezone,
    setWatchedChannel,
} from "../../database/database.js";

import { ensureCurrentPeriod, getAnnouncementTime } from "../../krillion/periods.js";
import {
    getPeriodScoreCount,
} from "../../database/database.js";

import { DateTime } from "luxon";

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

        case "announcement":
            await handleAnnouncementCommand(message, args[2]);
            break;

        case "timezone":
            await handleTimezoneCommand(message, args[2]);
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
        "`!krillion channel #channel`\n" +
        "`!krillion announcement 16:00`\n" +
        "`!krillion timezone America/Edmonton`\n\n" +

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

async function handleAnnouncementCommand(
    message: Message,
    value?: string
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

    if (!value) {
        await message.reply(
            "Please provide an announcement time.\n\n" +
            "Example: `!krillion announcement 16:00`"
        );
        return;
    }

    const match =
        value.match(/^(\d{1,2}):(\d{2})$/);

    if (!match) {
        await message.reply(
            "Invalid time. Use 24-hour format, for example `16:00`."
        );
        return;
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {
        await message.reply(
            "Invalid time. Hours must be 0–23 and minutes must be 0–59."
        );
        return;
    }

    const config =
        getGuildConfig(
            message.guild.id
        );

    if (!config) {
        await message.reply(
            "Configure a Krillion channel first with `!krillion channel #channel`."
        );
        return;
    }

    setAnnouncementTime(
        message.guild.id,
        hour,
        minute
    );

    const formatted =
        DateTime
            .now()
            .setZone(config.timezone)
            .set({
                hour,
                minute,
            })
            .toFormat("h:mm a");

    await message.reply(
        `Krillion announcements will now be sent at **${formatted}** ` +
        `(${config.timezone}).`
    );
}

async function handleTimezoneCommand(
    message: Message,
    timezone?: string
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

    if (!timezone) {
        await message.reply(
            "Please provide a timezone.\n\n" +
            "Example: `!krillion timezone America/Edmonton`"
        );
        return;
    }

    const test =
        DateTime.now().setZone(timezone);

    if (!test.isValid) {
        await message.reply(
            `\`${timezone}\` is not a valid timezone.`
        );
        return;
    }

    setTimezone(
        message.guild.id,
        timezone
    );

    await message.reply(
        `Krillion timezone set to **${timezone}**.`
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
            .setZone(config.timezone);

    const periodEnd =
        DateTime
            .fromMillis(period.ends_at)
            .setZone(config.timezone);

    const nextAnnouncement =
        getAnnouncementTime(
            period,
            config.timezone,
            config.announcement_hour,
            config.announcement_minute
        );

    const announcementDate =
        DateTime
            .fromMillis(nextAnnouncement)
            .setZone(config.timezone);

    const game =
        period.game_number === null
            ? "Not detected yet"
            : `#${period.game_number}`;

    await message.reply(
        `📊 **Krillion Status**\n\n` +
        `**Channel:** <#${config.channel_id}>\n` +
        `**Timezone:** ${config.timezone}\n` +
        `**Announcement:** ${announcementDate.toFormat("h:mm a")}\n\n` +
        `**Current game:** ${game}\n` +
        `**Scores:** ${scoreCount}\n\n` +
        `**Current period:**\n` +
        `${periodStart.toFormat("MMM d, yyyy h:mm a")}\n` +
        `→ ${periodEnd.toFormat("MMM d, yyyy h:mm a")}\n\n` +
        `**Next announcement:**\n` +
        `${announcementDate.toFormat("MMM d, yyyy h:mm a")}`
    );
}