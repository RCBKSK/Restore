
const messageTemplates = require('./messageTemplates');

async function updateLotteryMessage(channel, messageId, lottery, includeButtons = true) {
    try {
        const message = await channel.messages.fetch(messageId);
        const updatedEmbed = messageTemplates.createLotteryEmbed(lottery);
        
        const components = [];
        if (includeButtons && lottery.status === 'active') {
            const { createActionRow } = require('./buttonHandlers');
            components.push(createActionRow(lottery.id));
        }

        await message.edit({
            embeds: [updatedEmbed],
            components: components
        });

        return true;
    } catch (error) {
        console.error(`Error updating message: ${error}`);
        return false;
    }
}

module.exports = {
    updateLotteryMessage
};
