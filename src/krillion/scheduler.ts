import {
    Client,
} from "discord.js";

import {
    getAllGuildConfigs,
    getExpiredPeriods,
    getGuildConfig,
    getPeriodLeaderboard,
    markPeriodAnnounced,
    type Period,
} from "../database/database.js";

import {
    ensureCurrentPeriod,
    getAnnouncementTime,
} from "./periods.js";

export function startScheduler(
    client: Client
): void {
    console.log(
        "Krillion scheduler started."
    );

    checkPeriods(client);

    setInterval(() => {
        checkPeriods(client);
    }, 60_000);
}

async function checkPeriods(
    client: Client
): Promise<void> {
    const configs =
        getAllGuildConfigs();

    /*
     * Make sure every configured guild
     * has a period for the current day.
     */
    for (const config of configs) {
        ensureCurrentPeriod(
            config.guild_id
        );
    }

    const now = Date.now();

    const periods =
        getExpiredPeriods(now);

    for (const period of periods) {
        const config =
            getGuildConfig(
                period.guild_id
            );

        if (!config) {
            console.error(
                `No configuration for guild ` +
                `${period.guild_id}`
            );

            continue;
        }

        /*
         * The period ended at midnight,
         * but we don't announce until the
         * configured announcement time.
         */
        const announcementTime =
            getAnnouncementTime(
                period,
                config.announcement_hour,
                config.announcement_minute
            );

        if (now < announcementTime) {
            continue;
        }

        try {
            await finalizePeriod(
                client,
                period
            );
        } catch (error) {
            console.error(
                `Failed to finalize period ${period.id}:`,
                error
            );
        }
    }
}

async function finalizePeriod(
    client: Client,
    period: Period
): Promise<void> {
        console.log(
        `[Krillion] Finalizing period ${period.id} ` +
        `(game #${period.game_number})`
    );
    /*
     * A period with no game means nobody
     * submitted a Krillion result that day.
     */
    if (period.game_number === null) {
        markPeriodAnnounced(
            period.id
        );

        console.log(
            `Marked empty Krillion period ` +
            `${period.id} as announced.`
        );

        return;
    }

    const config =
        getGuildConfig(
            period.guild_id
        );

    if (!config) {
        throw new Error(
            `No configuration for guild ` +
            `${period.guild_id}.`
        );
    }

    const leaderboard =
        getPeriodLeaderboard(
            period.id
        );

    const channel =
        await client.channels.fetch(
            config.channel_id
        );

    if (!channel) {
        throw new Error(
            `Configured channel ${config.channel_id} ` +
            `could not be found.`
        );
    }

    if (!channel.isSendable()) {
        throw new Error(
            `Configured channel ${config.channel_id} ` +
            `is not sendable.`
        );
    }

    const topThree =
        leaderboard.slice(0, 3);

    let announcement =
        `🏆 **Krillion #${period.game_number} Results**\n\n`;

    if (topThree.length === 0) {
        announcement +=
            "No scores were submitted.";
    } else {
        const medals = [
            "🥇",
            "🥈",
            "🥉",
        ];

        const lines = [];

        for (
            let index = 0;
            index < topThree.length;
            index++
        ) {
            const entry =
                topThree[index];

            const mention =
                `<@${entry.userId}>`;

            lines.push(
                `${medals[index]} ` +
                `${mention} — ` +
                `**${entry.score}**`
            );
        }

        announcement +=
            lines.join("\n");
}

    await channel.send({
        content: announcement,
        allowedMentions: {
            users: topThree.map(
                (entry) => entry.userId
            ),
        },
    });

    /*
     * The period has now been announced.
     *
     * We do NOT create the next period here.
     * Periods are calendar days and are created
     * independently by ensureCurrentPeriod().
     */
    markPeriodAnnounced(
        period.id
    );

    console.log(
        `Announced Krillion #${period.game_number} ` +
        `for period ${period.id}.`
    );
}