// Skip any skull checks for free lotteries
    if (lottery.ticketPrice === 0) {
        const success = lotteryManager.addParticipant(lotteryId, interaction.user.id);
        if (success) {
            await interaction.reply({ content: 'You have joined the lottery!', ephemeral: true });
            await notificationManager.sendJoinConfirmation(interaction.user, lottery);
        } else {
            await interaction.reply({ content: 'You are already participating in this lottery!', ephemeral: true });
        }
        return;
    }

    if (!skullManager.hasEnoughSkulls(interaction.user.id, lottery.ticketPrice)) {