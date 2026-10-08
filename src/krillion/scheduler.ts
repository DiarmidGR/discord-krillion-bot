import {
    Client,
} from "discord.js";

import {
    getAllGuildConfigs,
    getExpiredPeriods,
    getGuildConfig,
    getGuildParticipationStreak,
    getPeriodLeaderboard,
    getUserWinStreak,
    markPeriodAnnounced,
    type Period,
} from "../database/database.js";

import {
    ensureCurrentPeriod,
} from "./periods.js";

const WIN_STREAK_MILESTONES: Record<number, string> = {
    5: "Bloodthirsty",
    10: "Merciless",
    15: "Relentless",
    20: "Brutal",
    25: "Unstoppable",
    30: "Nuclear",
};

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

    for (const config of configs) {
        ensureCurrentPeriod(
            config.guild_id
        );
    }

    const now = Date.now();

    const periods =
        getExpiredPeriods(now);

    for (const period of periods) {
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

export async function finalizePeriod(
    client: Client,
    period: Period
): Promise<void> {
    if (period.announced) {
        return;
    }

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
        console.error(
            `No configuration for guild ` +
            `${period.guild_id}`
        );

        return;
    }

    const leaderboard =
        getPeriodLeaderboard(
            period.id
        );

    const channel =
        await client.channels.fetch(
            config.channel_id
        );

    if (!channel || !channel.isSendable()) {
        console.error(
            `Could not access channel ` +
            `${config.channel_id}`
        );

        return;
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

    const participationStreak =
        getGuildParticipationStreak(
            period.guild_id,
            period.game_number
        );

    announcement += participationStreak > 0
        ? `\n\n🔥 Server streak: ` +
          `**${participationStreak} ` +
          `${participationStreak === 1 ? "game" : "games"}**`
        : "\n\nNo active server streak.";

    const winner = topThree[0];

    if (winner) {
        const winStreak = getUserWinStreak(
            period.guild_id,
            winner.userId,
            period.game_number
        );
        const milestone =
            WIN_STREAK_MILESTONES[winStreak];

        if (milestone) {
            announcement +=
                `\n\n🔥 <@${winner.userId}> reached ` +
                `**${milestone}** with a ` +
                `**${winStreak}-game win streak**!`;
        }
    }

    await channel.send({
        content: announcement,
        allowedMentions: {
            users: topThree.map(
                (entry) => entry.userId
            ),
        },
    });

    markPeriodAnnounced(
        period.id
    );

    console.log(
        `Announced Krillion #${period.game_number} ` +
        `for period ${period.id}.`
    );
}