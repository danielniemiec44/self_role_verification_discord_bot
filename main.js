require('dotenv').config();

const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  MessageFlags,
  EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const selfRoleChannel = process.env.SELF_ROLE_CHANNEL;
const selfRoleId = process.env.SELF_ROLE_ID;
const selfRoleMessageTitle = process.env.SELF_ROLE_MESSAGE_TITLE;
const selfRoleMessageDescription = process.env.SELF_ROLE_MESSAGE_DESCRIPTION;
const selfRoleMessageFooter = process.env.SELF_ROLE_MESSAGE_FOOTER;
const selfRoleEmoji = process.env.SELF_ROLE_EMOJI;

// Zmienna przechowująca ID wiadomości z self role
let reactionMessageId = null;

if (!token) {
  console.error('Brak tokenu w pliku .env!');
  process.exit(1);
}
if (!clientId || !guildId) {
  console.error('Brak CLIENT_ID lub GUILD_ID w pliku .env!');
  process.exit(1);
}

const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ] });

const registerCommands = async () => {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data) {
      commands.push(command.data.toJSON());
    }
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`Rejestrowanie ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('Slash commands zostały pomyślnie zarejestrowane!');
  } catch (error) {
    console.error('Błąd podczas rejestracji slash commands:', error);
  }
};

registerCommands();

//function to remove messages created by this bot on this role channel
const removeMessages = async () => {
  const channel = await client.channels.fetch(selfRoleChannel);
  if (!channel || !channel.isTextBased()) {
    return console.error('Kanał tekstowy dla self roles nie znaleziony!');
  }

  const messages = await channel.messages.fetch();
  messages.forEach(async message => {
    if (message.author.id === client.user.id) {
      await message.delete();
    }
  });
};

client.once('ready', async () => {
  console.log(`Zalogowano jako ${client.user.tag}`);
  const readyEvent = require('./events/ready');
  readyEvent(client);

  const channel = await client.channels.fetch(selfRoleChannel);
  if (!channel || !channel.isTextBased()) {
    return console.error('Kanał tekstowy dla self roles nie znaleziony!');
  }

    await removeMessages();

  let messageContent = `${selfRoleMessageTitle}`;

  const embed = new EmbedBuilder()
      .setTitle(messageContent)
      .setDescription(selfRoleMessageDescription)
      .setColor(0x00AE86)
      .setThumbnail(client.guilds.cache.get(guildId).iconURL())
      .setFooter({ text: selfRoleMessageFooter });

  const message = await channel.send({ embeds: [embed] });
  reactionMessageId = message.id;

  await message.react(selfRoleEmoji);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const commandFile = path.join(__dirname, 'commands', `${interaction.commandName}.js`);
    if (fs.existsSync(commandFile)) {
      const command = require(commandFile);
      await command.execute(interaction);
    } else {
      await interaction.reply({ content: 'Nieznana komenda!', flags: MessageFlags.Ephemeral });
    }
  }
  
  if (interaction.isButton() || interaction.isModalSubmit()) {
    if (
      interaction.customId === 'ticket_button' || 
      interaction.customId === 'ticket_modal'
    ) {
      const ticketHandler = require(path.join(__dirname, 'commands', 'ticket.js'));
      await ticketHandler.execute(interaction);
    }
  }
  
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    await interaction.reply({ content: 'Zamykanie ticketu...', flags: MessageFlags.Ephemeral });
    
    try {
      await interaction.channel.send('Ticket zostanie zamknięty za kilka sekund.');
      setTimeout(async () => {
        await interaction.channel.delete('Ticket został zamknięty.');
      }, 3000);
    } catch (error) {
      console.error('Błąd przy zamykaniu ticketu:', error);
      await interaction.followUp({ content: 'Nie udało się zamknąć ticketu!', flags: MessageFlags.Ephemeral });
    }
  }
});


client.on('messageReactionAdd', async (reaction, user) => {
  // Ignore bot reactions
  if (user.bot) return;
  console.log("reaction", reaction);

  // If the reaction object is partial, fetch the full data
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Błąd przy pobieraniu reakcji (add):', error);
      return;
    }
  }

  if (reaction.message.id !== reactionMessageId) return;

  if (reaction.emoji.name === selfRoleEmoji) {
    const guild = reaction.message.guild;
    if (!guild) return;

    try {
      // Fetch the member who reacted
      const member = await guild.members.fetch(user.id);
      // Get the role by its ID
      const role = guild.roles.cache.get(selfRoleId);
      if (!role) {
        console.error(`Nie znaleziono roli o ID: ${selfRoleId}`);
        return;
      }
      // Add the role to the member
      await member.roles.add(role);
      console.log(`Dodano rolę ${role.name} użytkownikowi ${member.user.tag}`);
    } catch (error) {
      console.error('Błąd przy dodawaniu roli:', error);
    }
  }
});


//unreact removes role
client.on('messageReactionRemove', async (reaction, user) => {
  // Ignore bot reactions
  if (user.bot) return;

  // If the reaction object is partial, fetch the full data
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Błąd przy pobieraniu reakcji (remove):', error);
      return;
    }
  }

  if (reaction.message.id !== reactionMessageId) return;

  if (reaction.emoji.name === selfRoleEmoji) {
    const guild = reaction.message.guild;
    if (!guild) return;

    try {
      // Fetch the member who reacted
      const member = await guild.members.fetch(user.id);
      // Get the role by its ID
      const role = guild.roles.cache.get(selfRoleId);
      if (!role) {
        console.error(`Nie znaleziono roli o ID: ${selfRoleId}`);
        return;
      }
      // Remove the role from the member
      await member.roles.remove(role);
      console.log(`Usunięto rolę ${role.name} użytkownikowi ${member.user.tag}`);
    } catch (error) {
      console.error('Błąd przy usuwaniu roli:', error);
    }
  }
});


client.login(token);
