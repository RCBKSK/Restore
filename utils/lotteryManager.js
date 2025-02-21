const supabase = require('./supabaseClient');
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

    getParticipantTickets(lotteryId, userId) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery) return 0;
        return lottery.participants.get(userId) || 0;
    }

    getWinningProbability(lotteryId, userId) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery || !lottery.participants.has(userId)) return 0;

        const userTickets = this.getParticipantTickets(lotteryId, userId);
        if (lottery.totalTickets === 0) return 0;

        return (userTickets / lottery.totalTickets) * 100;
    }

    async addParticipant(lotteryId, userId, tickets = 1) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery || lottery.status !== 'active') return false;

        // Check if user is already participating
        if (lottery.participants.has(userId)) return false;

        // Check max tickets per user
        if (tickets > lottery.maxTicketsPerUser) return false;

        // Add participant with their tickets
        lottery.participants.set(userId, tickets);
        lottery.totalTickets += tickets;

        // Update Supabase and track analytics
        await this.updateParticipantsInDatabase(lotteryId);
        const analyticsManager = require('./analyticsManager');
        await analyticsManager.trackParticipation(lotteryId, userId, 'join', tickets);

        return true;
    }

    async updateParticipantsInDatabase(lotteryId) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery) return;

        try {
            const participantsObj = Object.fromEntries(lottery.participants);
            await supabase
                .from("lotteries")
                .update({ 
                    participants: participantsObj,
                    totalTickets: lottery.totalTickets
                })
                .eq("id", lotteryId);
        } catch (error) {
            console.error("Error updating participants in database:", error);
        }
    }


    // Create a new lottery
    async createLottery({ prize, winners, minParticipants, duration, createdBy, channelId, guildId, isManualDraw = false, ticketPrice = 0, maxTicketsPerUser = 1, terms = null }) {
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
                // Refund skulls to all participants
                for (const [userId, tickets] of lottery.participants) {
                    const refundAmount = tickets * lottery.ticketPrice;
                    if (refundAmount > 0) {
                        await skullManager.addSkulls(userId, refundAmount);
                        try {
                            const user = await this.client.users.fetch(userId);
                            await user.send(`Your ${refundAmount} skulls have been refunded for lottery ${lottery.id} (${lottery.prize}) due to insufficient participants.`);
                        } catch (error) {
                            console.error(`Failed to DM user ${userId} about refund:`, error);
                        }
                    }
                }
                
                await channel.send(
                    `⚠️ Lottery ${lottery.id} for ${lottery.prize} has ended without winners due to insufficient participants (${lottery.participants.size}/${lottery.minParticipants} required). All participants have been refunded.`
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
                
                // Record winners in analytics
                const analyticsManager = require('./analyticsManager');
                await analyticsManager.recordWinners(lotteryId, winners);
                
                // Record final participation stats
                for (const [userId, tickets] of lottery.participants) {
                    await analyticsManager.trackParticipation(lotteryId, userId, 'complete', tickets);
                }
                
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

            // Create userMentions map for winners and send DMs
            const userMentions = new Map();
            const notificationManager = require('./notificationManager');
            
            for (const winnerId of winners) {
                try {
                    const user = await this.client.users.fetch(winnerId);
                    userMentions.set(winnerId, user.toString());
                    // Send DM to winner
                    await notificationManager.notifyWinner(user, lottery, this.client);
                } catch (error) {
                    console.error(`Failed to fetch user ${winnerId}:`, error);
                    userMentions.set(winnerId, 'Unknown User');
                }
            }

            // Check if winners haven't been announced yet
            const { data } = await supabase
                .from("lotteries")
                .select("winnerAnnounced")
                .eq("id", lottery.id)
                .single();

            if (!data?.winnerAnnounced) {
                // Send winner announcement
                await channel.send({
                    embeds: [
                        messageTemplates.createWinnerEmbed(lottery, winners, userMentions),
                        messageTemplates.createCongratulationsEmbed(lottery.prize, winners, userMentions)
                    ]
                });

                // Update Supabase
                await supabase
                    .from("lotteries")
                    .update({ winnerAnnounced: true })
                    .eq("id", lottery.id);
            }
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

const lotteryManagerInstance = new LotteryManager();

module.exports = {
    LotteryManager,
    lotteryManager: lotteryManagerInstance
};