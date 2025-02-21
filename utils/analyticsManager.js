const { Collection } = require('discord.js');

class AnalyticsManager {
    constructor() {
        this.participationHistory = new Collection();
        this.lotteryStats = new Collection();
    }

    trackParticipation(lotteryId, userId, action, tickets = 1) {
        const timestamp = Date.now();

        // Initialize user history if not exists
        if (!this.participationHistory.has(userId)) {
            this.participationHistory.set(userId, []);
        }

        // Record participation
        this.participationHistory.get(userId).push({
            lotteryId,
            action, // 'join' or 'leave'
            tickets,
            timestamp
        });

        // Update lottery statistics
        if (!this.lotteryStats.has(lotteryId)) {
            this.lotteryStats.set(lotteryId, {
                totalParticipants: 0,
                uniqueParticipants: new Set(),
                joinTimestamps: [],
                winners: new Set(),
                totalTickets: 0
            });
        }

        const stats = this.lotteryStats.get(lotteryId);
        if (action === 'join') {
            stats.totalParticipants++;
            stats.uniqueParticipants.add(userId);
            stats.joinTimestamps.push(timestamp);
            stats.totalTickets += tickets;
        }
    }

    recordWinners(lotteryId, winners) {
        const stats = this.lotteryStats.get(lotteryId);
        if (stats) {
            winners.forEach(winnerId => stats.winners.add(winnerId));
        }
    }

    getParticipantStats(userId) {
        const history = this.participationHistory.get(userId) || [];
        const participatedLotteries = new Set(history.map(h => h.lotteryId));
        const wins = [...this.lotteryStats.values()]
            .filter(stats => stats.winners.has(userId)).length;
        const totalTickets = history
            .filter(h => h.action === 'join')
            .reduce((sum, h) => sum + (h.tickets || 1), 0);

        return {
            totalParticipations: history.length,
            uniqueLotteries: participatedLotteries.size,
            wins,
            totalTickets,
            winRate: participatedLotteries.size > 0 ? (wins / participatedLotteries.size) * 100 : 0
        };
    }

    getLotteryStats(lotteryId) {
        const stats = this.lotteryStats.get(lotteryId);
        if (!stats) return null;

        return {
            totalParticipants: stats.totalParticipants,
            uniqueParticipants: stats.uniqueParticipants.size,
            winners: stats.winners.size,
            totalTickets: stats.totalTickets,
            participationRate: stats.winners.size > 0 
                ? (stats.winners.size / stats.uniqueParticipants.size) * 100 
                : 0
        };
    }

    getGlobalStats() {
        const totalParticipations = [...this.participationHistory.values()]
            .reduce((sum, history) => sum + history.length, 0);

        const uniqueParticipants = this.participationHistory.size;

        const totalLotteries = this.lotteryStats.size;

        const totalWinners = [...this.lotteryStats.values()]
            .reduce((sum, stats) => sum + stats.winners.size, 0);

        const totalTickets = [...this.lotteryStats.values()]
            .reduce((sum, stats) => sum + (stats.totalTickets || 0), 0);

        return {
            totalParticipations,
            uniqueParticipants,
            totalLotteries,
            totalWinners,
            totalTickets,
            averageParticipationRate: totalLotteries > 0 
                ? (totalParticipations / totalLotteries) 
                : 0
        };
    }

    getMostActiveParticipants(limit = 10) {
        return [...this.participationHistory.entries()]
            .map(([userId, history]) => ({
                userId,
                participations: history.length,
                totalTickets: history
                    .filter(h => h.action === 'join')
                    .reduce((sum, h) => sum + (h.tickets || 1), 0),
                wins: [...this.lotteryStats.values()]
                    .filter(stats => stats.winners.has(userId)).length
            }))
            .sort((a, b) => b.participations - a.participations)
            .slice(0, limit);
    }
}

module.exports = new AnalyticsManager();