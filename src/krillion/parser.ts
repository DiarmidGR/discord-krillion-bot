export interface KrillionResult {
    gameNumber: number;
    score: number;
}

const KRILLION_REGEX = /^Krillion\s+#(\d+)\s+.*?\s(\d+)\s+/i;

export function parseKrillionMessage(
    content: string
): KrillionResult | null {
    const match = content.match(KRILLION_REGEX);

    if (!match) {
        return null;
    }

    const gameNumber = Number(match[1]);
    const score = Number(match[2]);

    if (!Number.isInteger(gameNumber) || !Number.isInteger(score)) {
        return null;
    }

    return {
        gameNumber,
        score,
    };
}