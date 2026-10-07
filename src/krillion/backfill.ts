import {
    ChannelType,
    Client,
} from "discord.js";

import {
    hasCompletedHistoricalBackfill,
    getAllGuildConfigs,
    markHistoricalBackfillComplete,
} from "../database/database.js";

import {
    ensureCurrentPeriod,
} from "./periods.js";

import {
    processKrillionMessage,
} from "./messages.js";

export async function backfillKrillionMessages(
    client: Client
): Promise<void> {
    const configs =
        getAllGuildConfigs();

    for (const config of configs) {
        await backfillGuild(
            client,
            config.guild_id,
            config.channel_id
        );
    }
}

async function backfillGuild(
    client: Client,
    guildId: string,
    channelId: string
): Promise<void> {
    const guild =
        await client.guilds.fetch(
            guildId
        );

    const channel =
        await guild.channels.fetch(
            channelId
        );

    if (
        !channel ||
        channel.type !== ChannelType.GuildText
    ) {
        console.error(
            `[Krillion] Cannot backfill channel ` +
            `${channelId} in guild ${guildId}`
        );

        return;
    }

    /*
     * Make sure today's calendar period
     * exists before processing messages.
     */
    const currentPeriod =
        ensureCurrentPeriod(
            guildId
        );

    if (!currentPeriod) {
        return;
    }

    const historicalBackfillComplete =
        hasCompletedHistoricalBackfill(
            guildId,
            channelId
        );

    const startTimestamp = historicalBackfillComplete
        ? currentPeriod.starts_at
        : null;

    let before: string | undefined;
    let messageCount = 0;

    while (true) {
        const batch =
            await channel.messages.fetch({
                limit: 100,
                ...(before
                    ? { before }
                    : {}),
            });

        if (batch.size === 0) {
            break;
        }

        const oldest =
            batch.last();

        if (!oldest) {
            break;
        }

        const messages = Array.from(
            batch.values()
        )
            .filter((message) =>
                startTimestamp === null ||
                message.createdTimestamp >= startTimestamp
            )
            .sort((first, second) =>
                first.createdTimestamp - second.createdTimestamp
            );

        for (const message of messages) {
            processKrillionMessage(
                message,
                message.createdTimestamp < currentPeriod.starts_at
            );
        }

        messageCount += messages.length;

        if (
            startTimestamp !== null &&
            oldest.createdTimestamp < startTimestamp
        ) {
            break;
        }

        before = oldest.id;
    }

    if (!historicalBackfillComplete) {
        markHistoricalBackfillComplete(
            guildId,
            channelId
        );
    }

    console.log(
        `[Krillion] Backfill found ` +
        `${messageCount} messages for ` +
        `guild ${guildId}.`
    );

    console.log(
        `[Krillion] Backfill complete for ` +
        `guild ${guildId}.`
    );
}