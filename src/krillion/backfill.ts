import {
    ChannelType,
    Client,
} from "discord.js";

import {
    getAllGuildConfigs,
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

    /*
     * Only backfill messages from the
     * beginning of the current calendar day.
     */
    const startTimestamp =
        currentPeriod.starts_at;

    let before: string | undefined;

    const messages = [];

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

        for (const message of batch.values()) {
            if (
                message.createdTimestamp >=
                startTimestamp
            ) {
                messages.push(message);
            }
        }

        const oldest =
            batch.last();

        if (!oldest) {
            break;
        }

        if (
            oldest.createdTimestamp <
            startTimestamp
        ) {
            break;
        }

        before = oldest.id;
    }

    /*
     * Discord returns newest → oldest.
     * Process oldest → newest so the first
     * Krillion result establishes the game.
     */
    messages.sort(
        (a, b) =>
            a.createdTimestamp -
            b.createdTimestamp
    );

    console.log(
        `[Krillion] Backfill found ` +
        `${messages.length} messages for ` +
        `guild ${guildId}.`
    );

    for (const message of messages) {
        processKrillionMessage(
            message
        );
    }

    console.log(
        `[Krillion] Backfill complete for ` +
        `guild ${guildId}.`
    );
}