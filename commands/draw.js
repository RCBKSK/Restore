const { SlashCommandBuilder } = require('@discordjs/builders');
const lotteryManager = require('../utils/lotteryManager');
const messageTemplates = require('../utils/messageTemplates');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('draw')
        .setDescription('Manually draw winners for a lottery')
        .addStringOption(option =>
            option.setName('lottery_id')
                .setDescription('ID of the lottery to draw winners for')
                .setRequired(true)),

    async execute(interaction) {
        // Check if user has admin role
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            await interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
            return;
        }

        const lotteryId = interaction.options.getString('lottery_id');
        const lottery = lotteryManager.getLottery(lotteryId);

        if (!lottery) {
            await interaction.reply({ content: 'Lottery not found!', ephemeral: true });
            return;
        }

        if (lottery.status !== 'active') {
            await interaction.reply({ content: 'This lottery is not active!', ephemeral: true });
            return;
        }

        if (!lottery.isManualDraw) {
            await interaction.reply({ 
                content: 'This lottery is set to auto-draw. Manual drawing is not allowed.',
                ephemeral: true 
            });
            return;
        }

        if (lottery.participants.size < lottery.minParticipants) {
            await interaction.reply({ 
                content: `Cannot draw winners: Minimum participants requirement (${lottery.minParticipants}) not met.`,
                ephemeral: true 
            });
            return;
        }

        const winners = await lotteryManager.drawWinners(lotteryId);
        if (!winners) {
            await interaction.reply({ content: 'Failed to draw winners.', ephemeral: true });
            return;
        }

        await interaction.reply({ content: 'Drawing winners...', ephemeral: true });

        const userMentions = new Map();
        for (const winnerId of winners) {
            try {
                const user = await interaction.client.users.fetch(winnerId);
                userMentions.set(winnerId, user.toString());
            } catch (error) {
                console.error(`Failed to fetch user ${winnerId}:`, error);
                userMentions.set(winnerId, 'Unknown User');
            }
        }

        const channel = await interaction.client.channels.fetch(lottery.channelid);
        if (channel) {
            await channel.send({
                embeds: [
                    messageTemplates.createWinnerEmbed(lottery, winners, userMentions),
                    messageTemplates.createCongratulationsEmbed(lottery.prize, winners, userMentions)
                ]
            });
        }
    }
};
