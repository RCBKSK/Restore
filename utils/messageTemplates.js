const { EmbedBuilder } = require('discord.js');

function formatTime(ms) {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
}

function createProgressBar(percentage) {
    const filledChar = '▰';
    const emptyChar = '▱';
    const totalBars = 10;
    const filledBars = Math.round(percentage * totalBars);
    const emptyBars = totalBars - filledBars;

    // Add sparkles at specific thresholds
    const sparkle = percentage <= 0.1 ? '✨' : '';
    return sparkle + filledChar.repeat(filledBars) + emptyChar.repeat(emptyBars) + sparkle;
}

function getTimeEmoji(percentage) {
    if (percentage >= 0.75) return '⏳';
    if (percentage >= 0.5) return '⌛';
    if (percentage >= 0.25) return '🕒';
    if (percentage >= 0.1) return '⚡';
    return '🔥';                                   // Fire emoji for last 10%
}

function getTimeColor(percentage) {
    if (percentage >= 0.75) return '#00FF00';      // Green
    if (percentage >= 0.5) return '#FFA500';       // Orange
    if (percentage >= 0.25) return '#FF7F50';      // Coral
    if (percentage >= 0.1) return '#FF4500';       // OrangeRed
    return '#FF0000';                              // Red for last 10%
}

module.exports = {
    createLotteryEmbed(lottery) {
        const isActive = lottery.status === 'active';
        const statusEmoji = {
            'active': '🟢 LIVE',
            'ended': '🔴 ENDED',
            'cancelled': '⚫ CANCELLED',
            'pending': '⏳ PENDING'
        }[lottery.status];

        const participantCount = lottery.participants ? lottery.participants.size : 0;
        const totalTickets = lottery.totalTickets || 0;
        const participantStatus = lottery.minParticipants 
            ? `${participantCount}/${lottery.minParticipants} Participants (${totalTickets} tickets)`
            : `${participantCount} Participants (${totalTickets} tickets)`;

        let timeDisplay = 'Ended';
        let timeProgress = '';
        let embedColor = '#808080';

        if (isActive) {
            const remainingMs = Math.max(0, lottery.endTime - Date.now());
            const totalDuration = lottery.endTime - lottery.startTime;
            const percentage = remainingMs / totalDuration;

            timeDisplay = formatTime(remainingMs);
            timeProgress = `${getTimeEmoji(percentage)} ${createProgressBar(percentage)}`;
            embedColor = getTimeColor(percentage);

            // Add extra visual effects for final countdown
            if (percentage <= 0.1) {
                timeDisplay = `⚠️ ENDING SOON: ${timeDisplay} ⚠️`;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`${isActive ? '🎉 Live SoulDraw!' : '🏁 SoulDraw Ended'} ${statusEmoji}`)
            .setColor(embedColor)
            .setDescription(`**Lottery ID: \`${lottery.id}\`**\n${
                isActive ? '🎟️ Join now for a chance to win!' : 'This lottery has ended.'
            }${isActive ? `\n\n${timeProgress}` : ''}`)
            .addFields(
                { name: '🎁 Prize', value: lottery.prize || 'No prize specified', inline: true },
                { name: `👥 Winners (${lottery.winners || 0})`, value: participantStatus || 'No participants', inline: true },
                { name: '⏰ Time', value: timeDisplay || 'Not set', inline: true },
                { name: '🎫 Ticket Info', value: lottery.ticketPrice > 0 ? `Price: ${lottery.ticketPrice} skulls\nMax per user: ${lottery.maxTicketsPerUser}` : 'Free entry' },
                { name: '📝 Terms', value: lottery.terms || 'Winner must have an active C61 account, or a redraw occurs!' },
                { name: '🎯 Requirements', value: lottery.minParticipants ? 
                    `Minimum ${lottery.minParticipants} participants required` : 'No minimum participants required' }
            )
            .setFooter({ text: `ID: ${lottery.id} • ${lottery.isManualDraw ? 'Manual Draw' : 'Auto Draw'} • ${statusEmoji}` })
            .setTimestamp();

        return embed;
    },

    createWinnerEmbed(lottery, winners, userMentions) {
        return new EmbedBuilder()
            .setTitle('🎊 LOTTERY WINNERS ANNOUNCED 🎊')
            .setColor('#00FF00')
            .setDescription(`The lottery for **${lottery.prize}** has concluded!\nLottery ID: \`${lottery.id}\``)
            .addFields(
                { name: '🏆 Winner(s)', value: winners.map(id => userMentions.get(id)).join('\n') },
                { name: '📊 Statistics', value: `Total Participants: ${lottery.participants.size}` }
            )
            .setFooter({ text: 'Congratulations to all winners! 🌟' })
            .setTimestamp();
    },

    createParticipantsEmbed(lottery, participantMentions) {
        const totalTickets = lottery.totalTickets || 0;
        const participantInfo = [];

        for (const [userId, tickets] of lottery.participants) {
            const mention = participantMentions.find(m => m.includes(userId)) || 'Unknown User';
            // For /rsd show tickets and probability, for /sd just show the user
            if (lottery.ticketPrice > 0) {
                const probability = (tickets / totalTickets * 100).toFixed(2);
                participantInfo.push(`${mention} - ${tickets} tickets (${probability}% chance)`);
            } else {
                participantInfo.push(mention);
            }
        }

        return new EmbedBuilder()
            .setTitle('👥 Current Participants')
            .setColor('#1E90FF')
            .setDescription(`**Lottery ID:** \`${lottery.id}\`\n**Prize:** ${lottery.prize}`)
            .addFields(
                { 
                    name: `Participants (${participantInfo.length})`, 
                    value: participantInfo.length > 0 ? participantInfo.join('\n') : 'No participants yet' 
                },
                {
                    name: '🎫 Total Tickets',
                    value: `${totalTickets} tickets sold`
                },
                {
                    name: '⏰ Time Remaining',
                    value: formatTime(lottery.endTime - Date.now())
                }
            )
            .setFooter({ text: `Min. Required: ${lottery.minParticipants || 'None'}` })
            .setTimestamp();
    },

    createCongratulationsEmbed(prize, winners, userMentions) {
        return new EmbedBuilder()
            .setTitle('🌟 CONGRATULATIONS! 🌟')
            .setColor('#FFD700')
            .setDescription(
                `🏆 **Winners**\n${winners.map(id => userMentions.get(id)).join('\n')}\n\n` +
                `🎁 **Prize Won:** ${prize}\n\n` +
                `📝 Please send your Polygon/Arena-Z Wallet Address to receive your prize.\n\n` +
                `💫 To all participants: Thank you for joining! Stay tuned for more exciting lotteries!`
            )
            .setTimestamp();
    },

    createStatusEmbed(lottery) {
        return new EmbedBuilder()
            .setTitle('📊 Lottery Status')
            .setColor('#1E90FF')
            .setDescription(`**Lottery ID:** \`${lottery.id}\``)
            .addFields(
                { name: '🎁 Prize', value: lottery.prize, inline: true },
                { name: '⏰ Time Remaining', value: formatTime(lottery.endTime - Date.now()), inline: true },
                { name: '👥 Participants', value: lottery.participants.size.toString(), inline: true },
                { name: '📌 Status', value: lottery.status.charAt(0).toUpperCase() + lottery.status.slice(1) }
            )
            .setTimestamp();
    },

    createAnalyticsEmbed(globalStats, topParticipants, userMentions) {
        return new EmbedBuilder()
            .setTitle('📊 SoulDraw Analytics Dashboard')
            .setColor('#4B0082')
            .addFields(
                {
                    name: '🌐 Global Statistics',
                    value: [
                        `📊 Total Participations: ${globalStats.totalParticipations}`,
                        `👥 Unique Participants: ${globalStats.uniqueParticipants}`,
                        `🎯 Total Lotteries: ${globalStats.totalLotteries}`,
                        `🏆 Total Winners: ${globalStats.totalWinners}`,
                        `📈 Avg. Participants/Lottery: ${globalStats.averageParticipationRate.toFixed(2)}`
                    ].join('\n')
                },
                {
                    name: '🏅 Most Active Participants',
                    value: topParticipants.length > 0
                        ? topParticipants.map((p, index) =>
                            `${index + 1}. ${userMentions.get(p.userId) || 'Unknown User'} - ${p.participations} entries, ${p.wins} wins`)
                            .join('\n')
                        : 'No participation data yet'
                }
            )
            .setTimestamp();
    },

    createUserStatsEmbed(userId, userStats, mention) {
        return new EmbedBuilder()
            .setTitle(`📊 Participant Statistics`)
            .setColor('#4B0082')
            .setDescription(`Statistics for ${mention}`)
            .addFields(
                {
                    name: '🎯 Participation Overview',
                    value: [
                        `🎟️ Total Participations: ${userStats.totalParticipations}`,
                        `🎪 Unique Lotteries: ${userStats.uniqueLotteries}`,
                        `🏆 Total Wins: ${userStats.wins}`,
                        `📊 Win Rate: ${(userStats.wins / userStats.uniqueLotteries * 100 || 0).toFixed(2)}%`
                    ].join('\n')
                }
            )
            .setTimestamp();
    }
};