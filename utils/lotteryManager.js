onst supabase = require('./supabaseClient');
const messageTemplates = require('./messageTemplates');
const { updateLotteryMessage } = require('./messageUpdater');

class LotteryManager {
    constructor() {
        this.lotteries = new Map();
        this.timers = new Map();
        this.updateIntervals = new Map();
        this.client = null;
    }

    // Set the Discord client
    setClient(client) {
        this.client = client;
    }

    // Get a lottery by ID
    getLottery(lotteryId) {
        return this.lotteries.get(lotteryId);
    }


    // Create a new lottery
    async createLottery({ prize, winners, minParticipants, duration, createdBy, channelId, guildId, isManualDraw = false, ticketPrice = 0, maxTicketsPerUser = 1, terms = "Winner must have an active C61 account, or a redraw occurs!" }) {
        try {
            const id = Date.now().toString();
            const startTime = Date.now();
            const endTime = startTime + duration;

            const lottery = {
                id,
                prize,
                winners: parseInt(winners),
                minParticipants: minParticipants || winners,
                terms,
                startTime,
                endTime,
                participants: {},
                maxTicketsPerUser,
                ticketPrice,
                messageId: null,
                guildId,
                isManualDraw,
                status: 'active',
                createdBy,
                totalTickets: 0,
                winnerList: [],
                channelid: channelId,
                israffle: false
            };

            const { error } = await supabase
                .from("lotteries")
                .insert([lottery]);

            if (error) throw error;

            lottery.participants = new Map(Object.entries(lottery.participants));
            this.lotteries.set(id, lottery);

            if (!isManualDraw) {
                this.setTimer(id, duration);
            }

            return lottery;
        } catch (error) {
            console.error("Error creating lottery:", error);
            throw error;
        }
    }

    // Get a lottery by ID
    getLottery(lotteryId) {
        return this.lotteries.get(lotteryId);
    }

    // Update lottery status in Supabase
    async updateStatus(lotteryId, status) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery) return;

        try {
            const { error } = await supabase
                .from("lotteries")
                .update({ status })
                .eq("id", lotteryId);

            if (error) throw error;
            lottery.status = status;
        } catch (error) {
            console.error("Error updating status:", error);
        }
    }

    // Handle failed lotteries (insufficient participants)
    async handleFailedLottery(lottery) {
        try {
            const channel = await this.client.channels.fetch(lottery.channelid);
            if (channel) {
                await channel.send(
                    `⚠️ Lottery ${lottery.id} for ${lottery.prize} has ended without winners due to insufficient participants (${lottery.participants.size}/${lottery.minParticipants} required).`
                );
            }
        } catch (error) {
            console.error("Error handling failed lottery:", error);
        }
    }

    // Set a timer for lottery end
    setTimer(lotteryId, duration) {
        if (this.timers.has(lotteryId)) {
            clearTimeout(this.timers.get(lotteryId));
        }
        const timer = setTimeout(() => this.endLottery(lotteryId), duration);
        this.timers.set(lotteryId, timer);
    }

    // Start message update interval
    startUpdateInterval(lottery) {
        if (this.updateIntervals.has(lottery.id)) {
            clearInterval(this.updateIntervals.get(lottery.id));
        }

        const updateFunc = async () => {
            try {
                const channel = await this.client.channels.fetch(lottery.channelid);
                await updateLotteryMessage(channel, lottery.messageId, lottery);
            } catch (error) {
                console.error(`Failed to update message for lottery ${lottery.id}:`, error);
                clearInterval(this.updateIntervals.get(lottery.id));
            }
        };

        const updateFrequency = this.calculateUpdateFrequency(lottery.endTime);
        const interval = setInterval(updateFunc, updateFrequency);
        this.updateIntervals.set(lottery.id, interval);
        updateFunc(); // Immediate first update
    }

    // Calculate update frequency based on remaining time
    calculateUpdateFrequency(endTime) {
        const remaining = endTime - Date.now();
        if (remaining <= 60000) return 5000; // Last minute: 5s updates
        if (remaining <= 300000) return 15000; // Last 5 minutes: 15s
        return 30000; // Default: 30s
    }

    // End a lottery
    async endLottery(lotteryId) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery || lottery.status !== "active") return;

        try {
            // Clear timers and intervals
            clearTimeout(this.timers.get(lotteryId));
            clearInterval(this.updateIntervals.get(lotteryId));

            // Check if lottery has enough participants
            if (lottery.participants.size >= lottery.minParticipants) {
                const winners = await this.drawWinners(lotteryId);
                await this.announceWinners(lottery, winners);
            } else {
                await this.handleFailedLottery(lottery);
            }

            await this.updateStatus(lotteryId, "ended");
        } catch (error) {
            console.error(`Error ending lottery ${lotteryId}:`, error);
            await this.updateStatus(lotteryId, "ended");
        }
    }

    // Draw winners for a lottery
    async drawWinners(lotteryId) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery || lottery.status !== "active") return [];

        const winners = new Set();
        const ticketPool = [];

        for (const [userId, tickets] of lottery.participants) {
            for (let i = 0; i < tickets; i++) {
                ticketPool.push(userId);
            }
        }

        while (winners.size < lottery.winners && ticketPool.length > 0) {
            const index = Math.floor(Math.random() * ticketPool.length);
            winners.add(ticketPool[index]);
            ticketPool.splice(index, 1);
        }

        const winnerArray = Array.from(winners);
        lottery.winnerList = winnerArray;

        try {
            const { error } = await supabase
                .from("lotteries")
                .update({
                    status: "ended",
                    winnerList: winnerArray.map(id => ({ id, username: "Unknown User" }))
                })
                .eq("id", lotteryId);

            if (error) throw error;
            return winnerArray;
        } catch (error) {
            console.error("Error updating winners:", error);
            throw error;
        }
    }

    // Announce winners
    async announceWinners(lottery, winners) {
        try {
            const channel = await this.client.channels.fetch(lottery.channelid);
            if (!channel) return;

            // Update final message
            await updateLotteryMessage(channel, lottery.messageId, lottery, false);

            // Send winner announcement
            await channel.send({
                embeds: [
                    messageTemplates.createWinnerEmbed(lottery, winners),
                    messageTemplates.createCongratulationsEmbed(lottery.prize, winners)
                ]
            });

            // Update Supabase
            await supabase
                .from("lotteries")
                .update({ winnerAnnounced: true })
                .eq("id", lottery.id);
        } catch (error) {
            console.error(`Error announcing winners for ${lottery.id}:`, error);
        }
    }

    // Restore active lotteries on bot start
    async getAllActiveLotteries() {
        try {
            const now = Date.now();
            const { data: lotteries, error } = await supabase
                .from("lotteries")
                .select("*")
                .or(`status.eq.active,endTime.gt.${now - 300000}`); // 5-minute buffer

            if (error) throw error;

            const restoredLotteries = [];

            for (const lotteryData of lotteries) {
                try {
                    console.log(`[Restoration] Processing lottery ${lotteryData.id}`);

                    // Convert participants to Map
                    lotteryData.participants = new Map(
                        Object.entries(lotteryData.participants || {})
                    );

                    // Validate critical fields
                    if (!lotteryData.channelid || !lotteryData.messageId) {
                        console.error(`[Restoration] Skipping lottery ${lotteryData.id} - Missing channel/message ID`);
                        await this.updateStatus(lotteryData.id, "ended");
                        continue;
                    }

                    // Check if lottery should be active
                    const isExpired = lotteryData.endTime <= now;
                    const shouldBeActive = !isExpired && lotteryData.status === "active";

                    if (shouldBeActive) {
                        console.log(`[Restoration] Reinitializing active lottery ${lotteryData.id}`);

                        // Store in memory
                        this.lotteries.set(lotteryData.id, lotteryData);

                        // Calculate remaining time
                        const remainingTime = lotteryData.endTime - now;

                        // Restart timers
                        this.setTimer(lotteryData.id, remainingTime);
                        this.startUpdateInterval(lotteryData);

                        restoredLotteries.push(lotteryData);
                    } else if (lotteryData.status === "active") {
                        console.log(`[Restoration] Handling expired active lottery ${lotteryData.id}`);
                        await this.endLottery(lotteryData.id);
                    }
                } catch (error) {
                    console.error(`[Restoration] Error processing lottery ${lotteryData.id}:`, error);
                }
            }

            console.log(`[Restoration] Successfully restored ${restoredLotteries.length} lotteries`);
            return restoredLotteries;
        } catch (error) {
            console.error("[Restoration] Error fetching lotteries:", error);
            return [];
        }
    }
}

module.exports = new LotteryManager();