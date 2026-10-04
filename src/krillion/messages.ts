import { Message } from "discord.js";

import { parseKrillionMessage } from "./parser.js";

import {
    saveScore,
    setPeriodGame,
} from "../database/database.js";

import {
    ensureCurrentPeriod,
} from "./periods.js";

export function processKrillionMessage(
    message: Message
): void {
    if (message.author.bot) {
        return;
    }

    if (!message.guild) {
        return;
    }

    const result =
        parseKrillionMessage(
            message.content
        );

    if (!result) {
        return;
    }

    const period =
        ensureCurrentPeriod(
            message.guild.id,
            message.createdTimestamp
        );

    if (!period) {
        return;
    }

    if (period.game_number === null) {
        setPeriodGame(
            period.id,
            result.gameNumber
        );

        period.game_number =
            result.gameNumber;

        console.log(
            `[Krillion] Period ${period.id} ` +
            `identified as game #${result.gameNumber}`
        );
    }

    if (
        result.gameNumber !==
        period.game_number
    ) {
        console.log(
            `[Krillion] Ignoring result:\n` +
            `  Guild: ${message.guild.id}\n` +
            `  Period: ${period.id}\n` +
            `  Expected game: #${period.game_number}\n` +
            `  Received game: #${result.gameNumber}\n` +
            `  User: ${message.author.tag}`
        );

        return;
    }

    console.log(
        `[Krillion] Result detected:\n` +
        `  User: ${message.author.tag}\n` +
        `  Game: #${result.gameNumber}\n` +
        `  Score: ${result.score}`
    );

    saveScore({
        periodId: period.id,
        guildId: message.guild.id,
        channelId: message.channel.id,
        userId: message.author.id,
        gameNumber: result.gameNumber,
        score: result.score,
        messageId: message.id,
    });

    console.log(
        `[Krillion] Score saved.`
    );
}