const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { lotteryManager } = require('../utils/lotteryManager');
const messageTemplates = require('../utils/messageTemplates');
const permissionChecker = require('../utils/permissionChecker');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sd')
        .setDescription('Start a new lottery draw')
        .addStringOption(option =>
            option.setName('time')
                .setDescription(`Duration (${Math.floor(config.minTimeLimit/60000)}m to 24h, e.g., 1h, 30m)`)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('prize')
                .setDescription('Prize for the lottery')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription(`Number of winners (max: ${config.maxWinners})`)
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('min_participants')
                .setDescription('Minimum number of participants required')
                .setMinValue(1)
                .setMaxValue(1000)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('terms')
                .setDescription('Terms and conditions for participation')
                .setRequired(false)),

    async execute(interaction) {
        try {
            if (!permissionChecker.hasPermission(interaction.member, 'sd')) {
                try {
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.reply({ 
                            content: permissionChecker.getMissingPermissionMessage('sd'),
                            ephemeral: true 
                        });
                    } else {
                        await interaction.followUp({ 
                            content: permissionChecker.getMissingPermissionMessage('sd'),
                            ephemeral: true 
                        });
                    }
                } catch (error) {
                    console.error('Error replying to permission check:', error);
                }
                return;
            }

            const timeStr = interaction.options.getString('time');
            const duration = parseTime(timeStr);
            if (!duration || duration < config.minTimeLimit || duration > config.defaultMaxTime) {
                try {
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.reply({
                            content: `Invalid time format or duration! Please use format like 1h, 30m (minimum ${Math.floor(config.minTimeLimit/60000)}m, maximum 24h)`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.followUp({
                            content: `Invalid time format or duration! Please use format like 1h, 30m (minimum ${Math.floor(config.minTimeLimit/60000)}m, maximum 24h)`,
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    console.error('Error replying to invalid time:', error);
                }
                return;
            }

            const winners = Math.min(interaction.options.getInteger('winners'), config.maxWinners);
            const minParticipants = interaction.options.getInteger('min_participants');

            if (minParticipants && minParticipants < winners) {
                try {
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.reply({
                            content: 'Minimum participants must be greater than or equal to the number of winners!',
                            ephemeral: true
                        });
                    } else {
                        await interaction.followUp({
                            content: 'Minimum participants must be greater than or equal to the number of winners!',
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    console.error('Error replying to min participant check:', error);
                }
                return;
            }

            const lottery = await lotteryManager.createLottery({
                interaction,
                prize: interaction.options.getString('prize'),
                winners,
                minParticipants,
                terms: interaction.options.getString('terms'),
                duration,
                createdBy: interaction.user.id,
                isManualDraw: false,
                ticketPrice: 0,
                maxTicketsPerUser: 1,
                isRaffle: false
            });

            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_${lottery.id}`)
                        .setLabel('Confirm')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`cancel_${lottery.id}`)
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Danger)
                );

            const drawMethodRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`auto_${lottery.id}`)
                        .setLabel('Auto Draw')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`manual_${lottery.id}`)
                        .setLabel('Manual Draw')
                        .setStyle(ButtonStyle.Primary)
                );

            try {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.reply({
                        content: 'Please confirm the lottery settings:',
                        embeds: [messageTemplates.createLotteryEmbed(lottery)],
                        components: [confirmRow, drawMethodRow],
                        ephemeral: true
                    });
                } else {
                    await interaction.followUp({
                        content: 'Please confirm the lottery settings:',
                        embeds: [messageTemplates.createLotteryEmbed(lottery)],
                        components: [confirmRow, drawMethodRow],
                        ephemeral: true
                    });
                }
            } catch (error) {
                console.error('Error replying with lottery settings:', error);
            }

            lottery.channelid = interaction.channelId;
            lottery.guildId = interaction.guildId;

        } catch (error) {
            console.error('Error in lottery command:', error);
            try {
                const response = {
                    content: 'An error occurred while creating the lottery. Please try again.',
                    ephemeral: true
                };
                
                if (interaction.deferred) {
                    await interaction.editReply(response);
                } else if (!interaction.replied) {
                    await interaction.reply(response);
                }
            } catch (error) {
                console.error('Failed to send error message:', error);
            }
        }
    }
};

function parseTime(timeStr) {
    const hours = timeStr.match(/(\d+)h/);
    const minutes = timeStr.match(/(\d+)m/);

    let duration = 0;
    if (hours) duration += parseInt(hours[1]) * 60 * 60 * 1000;
    if (minutes) duration += parseInt(minutes[1]) * 60 * 1000;

    return duration;
}