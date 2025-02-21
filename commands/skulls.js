const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const skullManager = require('../utils/skullManager');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skulls')
        .setDescription('Manage SoulDraw skulls')
        .addSubcommand(subcommand =>
            subcommand
                .setName('balance')
                .setDescription('Check your skull balance'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add skulls to a user (Admin only)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to add skulls to')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of skulls to add')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove skulls from a user (Admin only)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove skulls from')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of skulls to remove')
                        .setRequired(true)
                        .setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('gift')
                .setDescription('Gift skulls to another user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to gift skulls to')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of skulls to gift')
                        .setRequired(true)
                        .setMinValue(1))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'balance') {
            const balance = skullManager.getBalance(interaction.user.id);
            const embed = new EmbedBuilder()
                .setTitle('💀 Skull Balance')
                .setColor('#FFD700')
                .setDescription(`You currently have **${balance}** skulls`)
                .setFooter({ text: 'Contact an admin to purchase more skulls' });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        if (subcommand === 'gift') {
            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');

            // Prevent gifting to self
            if (targetUser.id === interaction.user.id) {
                await interaction.reply({ 
                    content: 'You cannot gift skulls to yourself!',
                    ephemeral: true 
                });
                return;
            }

            // Check if user has enough skulls
            if (!skullManager.hasEnoughSkulls(interaction.user.id, amount)) {
                await interaction.reply({ 
                    content: `You don't have enough skulls! Your balance: ${skullManager.getBalance(interaction.user.id)}`,
                    ephemeral: true 
                });
                return;
            }

            // Transfer skulls
            const success = skullManager.transferSkulls(interaction.user.id, targetUser.id, amount);
            if (success) {
                await interaction.reply({ 
                    content: `Successfully gifted ${amount} skulls to ${targetUser.toString()}!`,
                    ephemeral: true 
                });

                // DM the recipient about received skulls
                try {
                    await targetUser.send(`${interaction.user.toString()} has gifted you ${amount} skulls! Your new balance is ${skullManager.getBalance(targetUser.id)} skulls.`);
                } catch (error) {
                    console.error('Failed to send DM to gift recipient:', error);
                }
            } else {
                await interaction.reply({ 
                    content: 'Failed to gift skulls. Please try again.',
                    ephemeral: true 
                });
            }
            return;
        }

        // Admin-only commands
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            await interaction.reply({ 
                content: 'You do not have permission to use this command!',
                ephemeral: true 
            });
            return;
        }

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (subcommand === 'add') {
            const newBalance = skullManager.addSkulls(targetUser.id, amount);
            await interaction.reply({ 
                content: `Added ${amount} skulls to ${targetUser.toString()}. New balance: ${newBalance} skulls`,
                ephemeral: true 
            });

            // DM the user about their received skulls
            try {
                await targetUser.send(`An admin has added ${amount} skulls to your balance. Your new balance is ${newBalance} skulls.`);
            } catch (error) {
                console.error('Failed to send DM to user:', error);
            }
        } else if (subcommand === 'remove') {
            const success = skullManager.removeSkulls(targetUser.id, amount);
            if (success) {
                const newBalance = skullManager.getBalance(targetUser.id);
                await interaction.reply({ 
                    content: `Removed ${amount} skulls from ${targetUser.toString()}. New balance: ${newBalance} skulls`,
                    ephemeral: true 
                });

                // DM the user about their removed skulls
                try {
                    await targetUser.send(`An admin has removed ${amount} skulls from your balance. Your new balance is ${newBalance} skulls.`);
                } catch (error) {
                    console.error('Failed to send DM to user:', error);
                }
            } else {
                await interaction.reply({ 
                    content: `${targetUser.toString()} does not have enough skulls! Current balance: ${skullManager.getBalance(targetUser.id)}`,
                    ephemeral: true 
                });
            }
        }
    }
};
