import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDirectory =
    path.resolve("data");

fs.mkdirSync(
    dataDirectory,
    {
        recursive: true,
    }
);

const dbPath =
    path.join(
        dataDirectory,
        "krillion.db"
    );

const db =
    new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
    CREATE TABLE IF NOT EXISTS guild_config (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        game_number INTEGER,
        starts_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        announced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_id INTEGER NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        game_number INTEGER NOT NULL,
        score INTEGER NOT NULL,
        message_id TEXT NOT NULL UNIQUE,
        submitted_at INTEGER NOT NULL,

        UNIQUE(period_id, user_id),

        FOREIGN KEY(period_id)
            REFERENCES periods(id)
    );

    CREATE TABLE IF NOT EXISTS historical_backfills (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_period_guild_start
    ON periods(guild_id, starts_at);
`);

export function setWatchedChannel(
    guildId: string,
    channelId: string
): void {
    const statement = db.prepare(`
        INSERT INTO guild_config (
            guild_id,
            channel_id
        )
        VALUES (?, ?)
        ON CONFLICT(guild_id)
        DO UPDATE SET channel_id = excluded.channel_id
    `);

    statement.run(guildId, channelId);
}

export function hasCompletedHistoricalBackfill(
    guildId: string,
    channelId: string
): boolean {
    const statement = db.prepare(`
        SELECT completed
        FROM historical_backfills
        WHERE guild_id = ?
          AND channel_id = ?
    `);

    const result = statement.get(
        guildId,
        channelId
    ) as { completed: number } | undefined;

    return result?.completed === 1;
}

export function markHistoricalBackfillComplete(
    guildId: string,
    channelId: string
): void {
    const statement = db.prepare(`
        INSERT INTO historical_backfills (
            guild_id,
            channel_id,
            completed
        )
        VALUES (?, ?, 1)
        ON CONFLICT(guild_id)
        DO UPDATE SET
            channel_id = excluded.channel_id,
            completed = 1
    `);

    statement.run(guildId, channelId);
}

export interface GuildConfig {
    guild_id: string;
    channel_id: string;
}

export function getGuildConfig(
    guildId: string
): GuildConfig | null {
    const statement = db.prepare(`
        SELECT
            guild_id,
            channel_id,
            announcement_hour,
            announcement_minute
        FROM guild_config
        WHERE guild_id = ?
    `);

    return statement.get(guildId) as GuildConfig | null;
}

export function getCurrentPeriodLeaderboard(
    periodId: number
): LeaderboardEntry[] {
    const statement = db.prepare(`
        SELECT
            user_id AS userId,
            score
        FROM scores
        WHERE period_id = ?
        ORDER BY score DESC, submitted_at ASC
        LIMIT 3
    `);

    return statement.all(periodId) as LeaderboardEntry[];
}

export function getWatchedChannel(
    guildId: string
): string | null {
    const config = getGuildConfig(guildId);

    return config?.channel_id ?? null;
}

export interface SaveScore {
    periodId: number;
    guildId: string;
    channelId: string;
    userId: string;
    gameNumber: number;
    score: number;
    messageId: string;
}

export function saveScore(data: SaveScore): void {
    const statement = db.prepare(`
        INSERT INTO scores (
            period_id,
            guild_id,
            channel_id,
            user_id,
            game_number,
            score,
            message_id,
            submitted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)

        ON CONFLICT(period_id, user_id)
        DO UPDATE SET
            score = MAX(score, excluded.score),

            message_id = CASE
                WHEN excluded.score > score
                THEN excluded.message_id
                ELSE message_id
            END,

            submitted_at = CASE
                WHEN excluded.score > score
                THEN excluded.submitted_at
                ELSE submitted_at
            END
    `);

    statement.run(
        data.periodId,
        data.guildId,
        data.channelId,
        data.userId,
        data.gameNumber,
        data.score,
        data.messageId,
        Date.now()
    );
}

export interface LeaderboardEntry {
    userId: string;
    score: number;
}

export function getLeaderboard(
    guildId: string,
    gameNumber: number
): LeaderboardEntry[] {
    const statement = db.prepare(`
        SELECT
            user_id AS userId,
            score
        FROM scores
        WHERE guild_id = ?
          AND game_number = ?
        ORDER BY score DESC
    `);

    return statement.all(
        guildId,
        gameNumber
    ) as LeaderboardEntry[];
}

export interface Period {
    id: number;
    guild_id: string;
    game_number: number | null;
    starts_at: number;
    ends_at: number;
    announced: number;
}

export function getActivePeriod(
    guildId: string,
    now: number
): Period | null {
    const statement = db.prepare(`
        SELECT *
        FROM periods
        WHERE guild_id = ?
          AND starts_at <= ?
          AND ends_at > ?
          AND announced = 0
        ORDER BY starts_at DESC
        LIMIT 1
    `);

    return statement.get(
        guildId,
        now,
        now
    ) as Period | null;
}

export function createPeriod(
    guildId: string,
    startsAt: number,
    endsAt: number
): number {
    const statement = db.prepare(`
        INSERT INTO periods (
            guild_id,
            starts_at,
            ends_at
        )
        VALUES (?, ?, ?)
    `);

    const result = statement.run(
        guildId,
        startsAt,
        endsAt
    );

    return Number(result.lastInsertRowid);
}

export function setPeriodGame(
    periodId: number,
    gameNumber: number
): void {
    const statement = db.prepare(`
        UPDATE periods
        SET game_number = ?
        WHERE id = ?
    `);

    statement.run(
        gameNumber,
        periodId
    );
}

export function getAllGuildConfigs(): GuildConfig[] {
    const statement = db.prepare(`
        SELECT
            guild_id,
            channel_id,
            announcement_hour,
            announcement_minute
        FROM guild_config
    `);

    return statement.all() as GuildConfig[];
}

export function getExpiredPeriods(
    now: number
): Period[] {
    const statement = db.prepare(`
        SELECT *
        FROM periods
        WHERE ends_at <= ?
          AND announced = 0
        ORDER BY ends_at ASC
    `);

    return statement.all(now) as Period[];
}

export function markPeriodAnnounced(
    periodId: number
): void {
    // Intentionally only select periods where game_number isn't null,
    // nothing to announce if no game was played during this period.
    const statement = db.prepare(`
        UPDATE periods
        SET announced = 1
        WHERE id = ?
    `);

    statement.run(periodId);
}

export function getPeriodLeaderboard(
    periodId: number
): LeaderboardEntry[] {
    const statement = db.prepare(`
        SELECT
            user_id AS userId,
            score
        FROM scores
        WHERE period_id = ?
        ORDER BY score DESC, submitted_at ASC
    `);

    return statement.all(periodId) as LeaderboardEntry[];
}

export function getUserWinStreak(
    guildId: string,
    userId: string,
    gameNumber: number
): number {
    const statement = db.prepare(`
        WITH ranked_scores AS (
            SELECT
                game_number,
                user_id,
                ROW_NUMBER() OVER (
                    PARTITION BY game_number
                    ORDER BY score DESC, submitted_at ASC
                ) AS rank
            FROM scores
            WHERE guild_id = ?
              AND game_number <= ?
        )
        SELECT game_number, user_id
        FROM ranked_scores
        WHERE rank = 1
        ORDER BY game_number DESC
    `);

    const winners = statement.all(
        guildId,
        gameNumber
    ) as { game_number: number; user_id: string }[];

    let expectedGame = gameNumber;
    let streak = 0;

    for (const winner of winners) {
        if (
            winner.game_number !== expectedGame ||
            winner.user_id !== userId
        ) {
            break;
        }

        streak++;
        expectedGame--;
    }

    return streak;
}

// Function to track the number of consecutive games a given server has participated in. Used in nightly
// announcements as a streak counter.
export function getGuildParticipationStreak(
    guildId: string,
    gameNumber?: number
): number {
    const games = gameNumber === undefined
        ? db.prepare(`
            SELECT DISTINCT game_number
            FROM scores
            WHERE guild_id = ?
            ORDER BY game_number DESC
        `).all(guildId) as { game_number: number }[]
        : db.prepare(`
            SELECT DISTINCT game_number
            FROM scores
            WHERE guild_id = ?
              AND game_number <= ?
            ORDER BY game_number DESC
        `).all(
            guildId,
            gameNumber
        ) as { game_number: number }[];

    let expectedGame =
        gameNumber ?? games[0]?.game_number;

    if (expectedGame === undefined) {
        return 0;
    }

    let streak = 0;

    for (const game of games) {
        if (game.game_number !== expectedGame) {
            break;
        }

        streak++;
        expectedGame--;
    }

    return streak;
}

export function getLatestPeriod(
    guildId: string
): Period | null {
    const statement = db.prepare(`
        SELECT *
        FROM periods
        WHERE guild_id = ?
        ORDER BY starts_at DESC
        LIMIT 1
    `);

    return statement.get(
        guildId
    ) as Period | null;
}

export function getPeriodById(
    periodId: number
): Period | null {
    const statement = db.prepare(`
        SELECT *
        FROM periods
        WHERE id = ?
    `);

    return statement.get(
        periodId
    ) as Period | null;
}

export function getPeriodForTimestamp(
    guildId: string,
    timestamp: number
): Period | null {
    const statement = db.prepare(`
        SELECT *
        FROM periods
        WHERE guild_id = ?
          AND starts_at <= ?
          AND ends_at > ?
        LIMIT 1
    `);

    return (
        statement.get(
            guildId,
            timestamp,
            timestamp
        ) as Period | undefined
    ) ?? null;
}

export function finalizePeriodAndCreateNext(
    period: Period
): void {
    const duration =
        period.ends_at - period.starts_at;

    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE periods
            SET announced = 1
            WHERE id = ?
        `).run(period.id);

        db.prepare(`
            INSERT OR IGNORE INTO periods (
                guild_id,
                game_number,
                starts_at,
                ends_at,
                announced
            )
            VALUES (?, NULL, ?, ?, 0)
        `).run(
            period.guild_id,
            period.ends_at,
            period.ends_at + duration
        );
    });

    transaction();
}

// Returns the number of scores recorded for a given period.
// Used in !krillion status command
export function getPeriodScoreCount(
    periodId: number
): number {
    const statement = db.prepare(`
        SELECT COUNT(*) AS count
        FROM scores
        WHERE period_id = ?
    `);

    const result = statement.get(
        periodId
    ) as { count: number };

    return result.count;
}

db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_period_guild_start
    ON periods(guild_id, starts_at);
`);