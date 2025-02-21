
const { Collection } = require('discord.js');
const supabase = require('./supabaseClient');

class AnalyticsManager {
    constructor() {
        this.participationHistory = new Collection();
        this.lotteryStats = new Collection();
    }

    async trackParticipation(lotteryId, userId, action, tickets = 1) {
        const timestamp = Date.now();

        // Record participation in Supabase
        const { error } = await supabase
            .from('participation_history')
            .insert({
                lottery_id: lotteryId,
                user_id: userId,
                action,
                tickets,
                timestamp
            });

        if (error) throw error;

        // Keep memory cache for quick access
        if (!this.participationHistory.has(userId)) {
            this.participationHistory.set(userId, []);
        }
        this.participationHistory.get(userId).push({
            lotteryId,
            action,
            tickets,
            timestamp
        });

        // Update lottery statistics in Supabase
        if (action === 'join') {
            const { error: statsError } = await supabase
                .from('lottery_stats')
                .upsert({
                    lottery_id: lotteryId,
                    total_participants: 1,
                    total_tickets: tickets
                });

            if (statsError) throw statsError;
        }
    }

    async recordWinners(lotteryId, winners) {
        const { error } = await supabase
            .from('lottery_winners')
            .insert(winners.map(winnerId => ({
                lottery_id: lotteryId,
                user_id: winnerId
            })));

        if (error) throw error;
    }

    async getParticipantStats(userId) {
        const { data: history, error } = await supabase
            .from('participation_history')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;

        const { data: wins, error: winsError } = await supabase
            .from('lottery_winners')
            .select('lottery_id')
            .eq('user_id', userId);

        if (winsError) throw winsError;

        const participatedLotteries = new Set(history.map(h => h.lottery_id));
        const totalTickets = history
            .filter(h => h.action === 'join')
            .reduce((sum, h) => sum + (h.tickets || 1), 0);

        return {
            totalParticipations: history.length,
            uniqueLotteries: participatedLotteries.size,
            wins: wins.length,
            totalTickets,
            winRate: participatedLotteries.size > 0 ? (wins.length / participatedLotteries.size) * 100 : 0
        };
    }

    async getLotteryStats(lotteryId) {
        const { data, error } = await supabase
            .from('lottery_stats')
            .select('*')
            .eq('lottery_id', lotteryId)
            .single();

        if (error) throw error;

        return {
            totalParticipants: data.total_participants,
            totalTickets: data.total_tickets,
            winners: data.winners || 0
        };
    }

    async getGlobalStats() {
        const { data: participations, error } = await supabase
            .from('participation_history')
            .select('user_id, lottery_id, tickets, action');

        if (error) throw error;

        const { data: winners, error: winnersError } = await supabase
            .from('lottery_winners')
            .select('*');

        if (winnersError) throw winnersError;

        const joinParticipations = participations.filter(p => p.action === 'join');
        const uniqueParticipants = new Set(joinParticipations.map(p => p.user_id)).size;
        const uniqueLotteries = new Set(joinParticipations.map(p => p.lottery_id)).size;
        const totalTickets = joinParticipations.reduce((sum, p) => sum + (p.tickets || 1), 0);
        return {
            totalParticipations: joinParticipations.length,
            uniqueParticipants,
            totalLotteries: uniqueLotteries,
            totalWinners: winners.length,
            totalTickets,
            averageParticipationRate: uniqueLotteries > 0 
                ? (joinParticipations.length / uniqueLotteries) 
                : 0
        };
    }

    async getMostActiveParticipants(limit = 10) {
        const { data, error } = await supabase
            .from('participation_history')
            .select('user_id, tickets')
            .eq('action', 'join'); // Only count actual participations

        if (error) throw error;

        const { data: winners, error: winnersError } = await supabase
            .from('lottery_winners')
            .select('user_id');

        if (winnersError) throw winnersError;

        // Group participations by user
        const participationsByUser = data.reduce((acc, p) => {
            if (!acc[p.user_id]) {
                acc[p.user_id] = 0;
            }
            acc[p.user_id] += p.tickets || 1;
            return acc;
        }, {});

        // Convert to array and sort
        const sortedParticipants = Object.entries(participationsByUser)
            .map(([userId, participations]) => ({
                userId,
                participations,
                wins: winners.filter(w => w.user_id === userId).length
            }))
            .sort((a, b) => b.participations - a.participations)
            .slice(0, limit);

        return sortedParticipants || [];
    }
}

module.exports = new AnalyticsManager();
