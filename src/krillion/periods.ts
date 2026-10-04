import { DateTime } from "luxon";

import {
    createPeriod,
    getGuildConfig,
    getPeriodForTimestamp,
} from "../database/database.js";

const KRILLION_TIMEZONE =
    "America/New_York";

export function ensureCurrentPeriod(
    guildId: string,
    timestamp: number = Date.now()
) {
    const config = getGuildConfig(guildId);

    if (!config) {
        return null;
    }

    const now = DateTime
        .fromMillis(timestamp)
        .setZone(KRILLION_TIMEZONE);

    const start = now.startOf("day");
    const end = start.plus({
        days: 1,
    });

    let period = getPeriodForTimestamp(
        guildId,
        timestamp
    );

    if (!period) {
        const periodId = createPeriod(
            guildId,
            start.toMillis(),
            end.toMillis()
        );

        period = {
            id: periodId,
            guild_id: guildId,
            game_number: null,
            starts_at: start.toMillis(),
            ends_at: end.toMillis(),
            announced: 0,
        };
    }

    return period;
}

export function getAnnouncementTime(
    period: {
        ends_at: number;
    },
    hour: number,
    minute: number
): number {
    const periodEnd =
        DateTime
            .fromMillis(period.ends_at)
            .setZone(KRILLION_TIMEZONE);

    return periodEnd
        .set({
            hour,
            minute,
            second: 0,
            millisecond: 0,
        })
        .toMillis();
}