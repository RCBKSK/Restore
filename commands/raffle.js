const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const lotteryManager = require('../utils/lotteryManager');
const messageTemplates = require('../utils/messageTemplates');
const permissionChecker = require('../utils/permissionChecker');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rsd')
        .setDescription('Start a new raffle with ticket system')
        .addStringOption(option =>
            option.setName('time')
                .setDescription(`Duration (${Math.floor(config.minTimeLimit/60000)}m to 24h, e.g., 1h, 30m)`)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('prize')
                .setDescription('Prize for the raffle')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription(`Number of winners (max: ${config.maxWinners})`)
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('ticket_price')
                .setDescription('Price per ticket (1-1000 skulls)')
                .setMinValue(1)
                .setMaxValue(1000)
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('max_tickets')
                .setDescription('Maximum tickets per user (1-1000)')
                .setMinValue(1)
                .setMaxValue(1000)
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
            // Check if user has permission to use this command
            if (!permissionChecker.hasPermission(interaction.member, 'rsd')) {
                await interaction.reply({ 
                    content: permissionChecker.getMissingPermissionMessage('rsd'),
                    ephemeral: true 
                });
                return;
            }

            // Parse time
            const timeStr = interaction.options.getString('time');
            const duration = parseTime(timeStr);
            if (!duration || duration < config.minTimeLimit || duration > config.defaultMaxTime) {
                await interaction.reply({
                    content: `Invalid time format or duration! Please use format like 1h, 30m (minimum ${Math.floor(config.minTimeLimit/60000)}m, maximum 24h)`,
                    ephemeral: true
                });
                return;
            }

            // Get and validate parameters
            const winners = Math.min(interaction.options.getInteger('winners'), config.maxWinners);
            const ticketPrice = interaction.options.getInteger('ticket_price');
            const maxTickets = interaction.options.getInteger('max_tickets');
            const minParticipants = interaction.options.getInteger('min_participants');

            // Additional validation for raffle-specific rules
            if (minParticipants && minParticipants < winners) {
                await interaction.reply({
                    content: 'Minimum participants must be greater than or equal to the number of winners!',
                    ephemeral: true
                });
                return;
            }

            const lottery = lotteryManager.createLottery({
                prize: interaction.options.getString('prize'),
                winners,
                minParticipants,
                terms: interaction.options.getString('terms'),
                duration,
                createdBy: interaction.user.id,
                isManualDraw: false,
                ticketPrice,
                maxTicketsPerUser: maxTickets,
                isRaffle: true // New flag to distinguish raffles
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

            await interaction.reply({
                content: 'Please confirm the raffle settings:',
                embeds: [messageTemplates.createLotteryEmbed(lottery)],
                components: [confirmRow, drawMethodRow],
                ephemeral: true
            });

            lottery.channelId = interaction.channelId;
            lottery.guildId = interaction.guildId;

        } catch (error) {
            console.error('Error in raffle command:', error);
            await interaction.reply({
                content: 'An error occurred while creating the raffle. Please try again.',
                ephemeral: true
            });
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