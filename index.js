const {
    Client,
    GatewayIntentBits,
    Collection,
    Partials,
    REST,
    Routes,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("./config.js");
const permissionChecker = require("./utils/permissionChecker");
const http = require("http");

// Initialize client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Channel],
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Register slash commands
const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
    try {
        console.log("Started refreshing application (/) commands.");
        const commands = [];
        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, file));
            if ("data" in command) commands.push(command.data.toJSON());
        }
        await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error("Error registering commands:", error);
    }
})();

// Initialize lottery manager
const lotteryManager = require("./utils/lotteryManager");
lotteryManager.setClient(client);

client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Loaded ${client.commands.size} commands`);

    // Restore active lotteries
    try {
        const activeLotteries = await lotteryManager.getAllActiveLotteries();
        console.log(`Restored ${activeLotteries.length} active lotteries`);
    } catch (error) {
        console.error("Restoration error:", error);
    }
    console.log("Bot is ready!");
});

// Interaction handling
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand() && !interaction.isButton()) return;

    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            console.log(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            console.log(`Executing command: ${interaction.commandName}`);
            await command.execute(interaction);
            console.log(`Successfully executed command: ${interaction.commandName}`);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);
            await interaction.reply({
                content: "There was an error executing this command!",
                flags: "EPHEMERAL"
            }).catch(() => {});
        }
    }

    if (interaction.isButton()) {
        if (!permissionChecker.hasPermission(interaction.member, "hlp")) {
            await interaction.reply({
                content: "You need at least participant role to interact with the lottery.",
                flags: "EPHEMERAL"
            });
            return;
        }

        const { handleButton } = require("./utils/buttonHandlers");
        try {
            console.log(`Processing button interaction: ${interaction.customId}`);
            await handleButton(interaction);
            console.log(`Successfully processed button: ${interaction.customId}`);
        } catch (error) {
            console.error("Button interaction error:", error);
            await interaction.reply({
                content: "There was an error processing this button!",
                flags: "EPHEMERAL"
            }).catch(() => {});
        }
    }
});

// Error handling
process.on("uncaughtException", error => console.error("Uncaught Exception:", error));
process.on("unhandledRejection", (reason, promise) =>
    console.error("Unhandled Rejection at:", promise, "reason:", reason));

// HTTP server
http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is running\n");
}).listen(process.env.PORT || 3000);

client.login(config.token).catch(error => {
    console.error("Login failed:", error);
    process.exit(1);
});