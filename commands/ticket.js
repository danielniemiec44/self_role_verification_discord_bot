const { 
  SlashCommandBuilder,
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ChannelType, 
  ButtonBuilder, 
  ButtonStyle,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Wyświetl panel do tworzenia ticketa'),
    
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const embed = new EmbedBuilder()
        .setTitle('Panel Ticket')
        .setDescription('Kliknij przycisk poniżej, aby otworzyć formularz ticketa.')
        .setColor(0x00AE86);
      
      const openButton = new ButtonBuilder()
        .setCustomId('ticket_button')
        .setLabel('Otwórz')
        .setStyle(ButtonStyle.Primary);
      
      const row = new ActionRowBuilder().addComponents(openButton);
      
      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }
    
    if (interaction.isButton() && interaction.customId === 'ticket_button') {
      const modal = new ModalBuilder()
        .setCustomId('ticket_modal')
        .setTitle('Utwórz Ticket');

      const serverNameInput = new TextInputBuilder()
        .setCustomId('serverName')
        .setLabel('Nazwa serwera:')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const numberOfPeopleInput = new TextInputBuilder()
        .setCustomId('numberOfPeople')
        .setLabel('Ilość osób:')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const adTypeInput = new TextInputBuilder()
        .setCustomId('adType')
        .setLabel('Reklama zwykła czy premium:')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const serverTypeInput = new TextInputBuilder()
        .setCustomId('serverType')
        .setLabel('Typ serwera:')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(serverNameInput),
        new ActionRowBuilder().addComponents(numberOfPeopleInput),
        new ActionRowBuilder().addComponents(adTypeInput),
        new ActionRowBuilder().addComponents(serverTypeInput)
      );

      await interaction.showModal(modal);
      return;
    }
    
    if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
      const serverName = interaction.fields.getTextInputValue('serverName');
      const numberOfPeople = interaction.fields.getTextInputValue('numberOfPeople');
      const adType = interaction.fields.getTextInputValue('adType');
      const serverType = interaction.fields.getTextInputValue('serverType');

      await interaction.reply({ content: 'Tworzenie ticketu...', flags: MessageFlags.Ephemeral });

      const guild = interaction.guild;
      if (!guild) return;

      const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
      let ticketChannel;
      try {
        ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          topic: `Ticket utworzony przez ${interaction.user.tag}`,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: ['ViewChannel'],
            },
            {
              id: interaction.user.id,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
            }
          ]
        });
      } catch (error) {
        console.error('Błąd przy tworzeniu kanału ticket:', error);
        await interaction.followUp({ content: 'Nie udało się stworzyć ticketu!', flags: MessageFlags.Ephemeral });
        return;
      }

      const acceptButton = new ButtonBuilder()
        .setCustomId('accept_ticket')
        .setLabel('Przyjmij')
        .setStyle(ButtonStyle.Success);

      const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Zamknij')
        .setStyle(ButtonStyle.Danger);

      const buttonRow = new ActionRowBuilder().addComponents(acceptButton, closeButton);

      const ticketMessage = `<@${interaction.user.id}> utworzył ticket.\n` +
        `**Nazwa serwera:** ${serverName}\n` +
        `**Ilość osób:** ${numberOfPeople}\n` +
        `**Reklama:** ${adType}\n` +
        `**Typ serwera:** ${serverType}`;

      const ticketEmbed = new EmbedBuilder()
        .setTitle('Ticket Utworzony')
        .setDescription(ticketMessage)
        .setColor(0x00AE86)
        .setTimestamp();

      await ticketChannel.send({ embeds: [ticketEmbed], components: [buttonRow] });

      await interaction.followUp({ content: `Ticket został utworzony: ${ticketChannel}`, flags: MessageFlags.Ephemeral });
    }
  }
};
