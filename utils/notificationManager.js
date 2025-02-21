const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { lotteryManager } = require("./lotteryManager");

class NotificationManager {
    constructor() {
        this.pendingNotifications = new Map();
    }

    async sendJoinConfirmation(user, lottery) {
        try {
            const tickets = lotteryManager.getParticipantTickets(
                lottery.id,
                user.id,
            );
            const probability = lotteryManager.getWinningProbability(
                lottery.id,
                user.id,
            );

            const embed = new EmbedBuilder()
                .setTitle("🎟️ Lottery Entry Confirmed!")
                .setColor("#00FF00")
                .setDescription(
                    `You have successfully joined the lottery for **${lottery.prize}**!`,
                )
                .addFields(
                    {
                        name: "🎫 Your Tickets",
                        value: `${tickets} tickets`,
                        inline: true,
                    },
                    {
                        name: "🎲 Win Chance",
                        value: `${probability.toFixed(2)}%`,
                        inline: true,
                    },
                    {
                        name: "⏰ Drawing In",
                        value: this.formatTimeRemaining(
                            lottery.endTime - Date.now(),
                        ),
                    },
                )
                .setFooter({ text: `Lottery ID: ${lottery.id}` })
                .setTimestamp();

            await user.send({ embeds: [embed] });
            return true;
        } catch (error) {
            console.error("Failed to send join confirmation:", error);
            return false;
        }
    }

    async cleanupStuckMessages(channelId, client) {
        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel) return;

            const messages = await channel.messages.fetch({ limit: 50 });
            const stuckMessages = messages.filter(
                (msg) =>
                    msg.embeds.length > 0 &&
                    msg.embeds[0].title === "📊 Lottery Status" &&
                    msg.embeds[0].fields.some(
                        (f) =>
                            f.name === "⏰ Time Remaining" &&
                            f.value.includes("-"),
                    ),
            );

            for (const msg of stuckMessages) {
                try {
                    await msg.delete();
                } catch (err) {
                    console.error("Error deleting stuck message:", err);
                }
            }
        } catch (error) {
            console.error("Error cleaning up stuck messages:", error);
        }
    }

    async scheduleEndingSoonNotification(lottery, client) {
        const notificationTime = lottery.endTime - 15 * 60 * 1000; // 15 minutes before end
        const now = Date.now();

        // Clean up any stuck messages first
        await this.cleanupStuckMessages(lottery.channelid, client);

        if (notificationTime > now) {
            this.pendingNotifications.set(
                lottery.id,
                setTimeout(async () => {
                    try {
                        for (const [userId] of lottery.participants) {
                            try {
                                const user = await client.users.fetch(userId);
                                const tickets =
                                    lotteryManager.getParticipantTickets(
                                        lottery.id,
                                        userId,
                                    );
                                const probability =
                                    lotteryManager.getWinningProbability(
                                        lottery.id,
                                        userId,
                                    );

                                const timeLeft = lottery.endTime - Date.now();
                                const urgencyEmoji =
                                    timeLeft <= 5 * 60 * 1000 ? "⚡" : "⚠️";
                                const sparkles =
                                    timeLeft <= 5 * 60 * 1000 ? "✨" : "";

                                const embed = new EmbedBuilder()
                                    .setTitle(
                                        `${urgencyEmoji} Lottery Ending Soon! ${urgencyEmoji}`,
                                    )
                                    .setColor("#FFA500")
                                    .setDescription(
                                        `${sparkles}The lottery for **${lottery.prize}** is ending in ${this.formatTimeRemaining(timeLeft)}!${sparkles}`,
                                    )
                                    .addFields(
                                        {
                                            name: "🎫 Your Tickets",
                                            value: `${tickets} tickets`,
                                            inline: true,
                                        },
                                        {
                                            name: "🎲 Current Win Chance",
                                            value: `${probability.toFixed(2)}%`,
                                            inline: true,
                                        },
                                        {
                                            name: "👥 Total Participants",
                                            value: `${lottery.participants.size}`,
                                            inline: true,
                                        },
                                    )
                                    .setFooter({
                                        text: `Lottery ID: ${lottery.id}`,
                                    })
                                    .setTimestamp();

                                await user.send({ embeds: [embed] });
                            } catch (error) {
                                console.error(
                                    `Failed to notify user ${userId}:`,
                                    error,
                                );
                            }
                        }
                    } catch (error) {
                        console.error(
                            "Failed to process ending soon notifications:",
                            error,
                        );
                    }
                }, notificationTime - now),
            );
        }
    }

    async notifyWinner(user, lottery, client) {
        try {
            const embed = new EmbedBuilder()
                .setTitle("🎉 Congratulations! You Won!")
                .setColor("#FFD700")
                .setDescription(
                    `You have won the lottery for **${lottery.prize}**!`,
                )
                .addFields(
                    { name: "🏆 Prize", value: lottery.prize },
                    {
                        name: "📝 Next Steps",
                        value: "Please select your wallet type and submit your address to claim your prize.",
                    },
                )
                .setFooter({ text: `Lottery ID: ${lottery.id}` })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`wallet_${lottery.id}_submit_polygon`)
                        .setLabel('Submit Polygon Wallet')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`wallet_${lottery.id}_submit_arenaz`)
                        .setLabel('Submit Arena-Z Wallet')
                        .setStyle(ButtonStyle.Primary)
                );

            await user.send({ embeds: [embed], components: [row] });
            return true;
        } catch (error) {
            console.error("Failed to send winner notification:", error);
            return false;
        }
    }

    cancelNotifications(lotteryId) {
        const timeout = this.pendingNotifications.get(lotteryId);
        if (timeout) {
            clearTimeout(timeout);
            this.pendingNotifications.delete(lotteryId);
        }
    }

    formatTimeRemaining(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);

        if (ms <= 60 * 1000) {
            // Last minute
            return `⚠️ ${seconds}s ⚠️`;
        } else if (ms <= 5 * 60 * 1000) {
            // Last 5 minutes
            return `⚡ ${minutes}m ${seconds}s ⚡`;
        } else {
            return `${hours}h ${minutes}m`;
        }
    }
}

module.exports = new NotificationManager();
