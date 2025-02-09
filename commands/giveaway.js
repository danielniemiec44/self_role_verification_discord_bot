const { 
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags
} = require('discord.js');

function parseTime(timeString) {
  let days = 0, hours = 0, minutes = 0, seconds = 0;
  
  const dayMatch = timeString.match(/(\d+)\s*d/i);
  if (dayMatch) {
    days = parseInt(dayMatch[1]);
  }
  
  const hourMatch = timeString.match(/(\d+)\s*h/i);
  if (hourMatch) {
    hours = parseInt(hourMatch[1]);
  }
  
  const minuteMatch = timeString.match(/(\d+)\s*m/i);
  if (minuteMatch) {
    minutes = parseInt(minuteMatch[1]);
  }
  
  const secondMatch = timeString.match(/(\d+)\s*s/i);
  if (secondMatch) {
    seconds = parseInt(secondMatch[1]);
  }
  
  return (((days * 24 * 60 * 60) + (hours * 60 * 60) + (minutes * 60) + seconds) * 1000);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('konkurs')
    .setDescription('Uruchamia konkurs (tylko dla administratorów)')
    .addStringOption(option =>
      option
        .setName('temat')
        .setDescription('O co jest konkurs (temat/przedmiot nagrody)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('czas')
        .setDescription('Czas trwania konkursu w formacie np. "1d 2h 30m 15s"')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('opis')
        .setDescription('Opis konkursu')
        .setRequired(true)
    ),
    
  async execute(interaction) {
    if (!interaction.memberPermissions.has("Administrator")) {
      return interaction.reply({ content: 'Brak uprawnień do uruchomienia konkursu.', flags: MessageFlags.Ephemeral });
    }
    
    const temat = interaction.options.getString('temat');
    const czasInput = interaction.options.getString('czas');
    const opis = interaction.options.getString('opis');
    
    const czasMs = parseTime(czasInput);
    if (isNaN(czasMs) || czasMs <= 0) {
      return interaction.reply({ content: 'Podany format czasu jest niepoprawny. Użyj np. "1d 2h 30m 15s".', flags: MessageFlags.Ephemeral });
    }
    
    const embed = new EmbedBuilder()
      .setTitle('Konkurs!')
      .addFields(
        { name: 'Temat', value: temat },
        { name: 'Opis', value: opis },
        { name: 'Czas trwania', value: czasInput }
      )
      .setColor(0x00AE86)
      .setTimestamp();
    
    const participateButton = new ButtonBuilder()
      .setCustomId('konkurs_participate')
      .setLabel('Weź udział')
      .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(participateButton);
    
    const contestMessage = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    
    const participants = new Set();
    
    const filter = i => i.customId === 'konkurs_participate';
    const collector = contestMessage.createMessageComponentCollector({ filter, time: czasMs });
    
    collector.on('collect', async i => {
      if (!participants.has(i.user.id)) {
        participants.add(i.user.id);
        try {
          await i.user.send(`Brałeś udział w konkursie: **${temat}**`);
        } catch (err) {
          console.log(`Nie udało się wysłać wiadomości do użytkownika ${i.user.tag}`);
        }
      }
      await i.reply({ content: 'Brałeś udział w konkursie!', flags: MessageFlags.Ephemeral });
    });
    
    collector.on('end', async () => {
      if (participants.size === 0) {
        await interaction.followUp({ content: 'Konkurs zakończony. Nie wzięło w nim udziału nikt.' });
        return;
      }
      
      const participantArray = Array.from(participants);
      const winnerId = participantArray[Math.floor(Math.random() * participantArray.length)];
      
      const winnerEmbed = new EmbedBuilder()
        .setTitle('Konkurs zakończony!')
        .setDescription(`Gratulacje <@${winnerId}>! Wygrałeś konkurs **${temat}**!`)
        .setColor(0xFFD700)
        .setTimestamp();
      
      await interaction.followUp({ embeds: [winnerEmbed] });
    });
  }
};
