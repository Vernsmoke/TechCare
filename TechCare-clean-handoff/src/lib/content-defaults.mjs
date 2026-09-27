export const guides = [
  {
    category: 'Operating system',
    title: 'Speed up a slow Windows PC',
    summary: 'A smoother start, without changing your hardware.',
    time: '4 min read',
    icon: 'desktop',
    steps: [
      'Restart your computer and note when it slows down.',
      'Check free storage space in Settings. Move only files you recognize and have backed up.',
      'Review startup apps in Task Manager. Disable only optional apps you recognize.',
      'Apply official Windows updates, then test again. If the issue continues, describe what you observed in Discussion.',
    ],
  },
  {
    category: 'Connectivity',
    title: 'Wi-Fi connected, no internet?',
    summary: 'Find out where the connection is getting stuck.',
    time: '3 min read',
    icon: 'wifi',
    steps: [
      'Try another device on the same network to see whether the issue is shared.',
      'Confirm the network name and Wi-Fi status. Avoid unfamiliar open networks.',
      'Restart the router only if you own it or are authorized to do so.',
      'Run the Windows network troubleshooter. For a campus network, contact the authorized IT team.',
    ],
  },
  {
    category: 'Hardware',
    title: 'Laptop won’t turn on?',
    summary: 'Start with a few safe, simple external checks.',
    time: '3 min read',
    icon: 'laptop',
    steps: [
      'Inspect the outlet and charger for visible damage. Do not use damaged equipment.',
      'Disconnect external devices and try turning the laptop on once.',
      'Record any lights, sounds, and screen response.',
      'Stop if the battery is swollen, the device is unusually hot, or you notice a burning smell. Seek qualified support.',
    ],
  },
  {
    category: 'Online safety',
    title: 'Spot a suspicious message',
    summary: 'Pause, check, and keep your information safe.',
    time: '4 min read',
    icon: 'shield',
    steps: [
      'Do not open unexpected attachments or follow links asking for passwords or payment.',
      'Check the sender’s full address, not just the display name.',
      'Contact the organization using an independently verified channel.',
      'Report the message through your email provider or campus IT. Do not publish private identifiers in a discussion.',
    ],
  },
].map((guide, index) => ({ ...guide, id: index + 1 }));

export const defaultBooth = {
  title: 'Your campus Tech Support Booth',
  description:
    'Safe, supervised support for laptops and desktop computers, with a focus on learning together.',
  label: 'Planned campus activity',
  date: '2026-10-16',
  dateNote: 'Planned date, pending College approval',
  venue: 'On campus',
  hours: 'Venue and hours to be confirmed',
  image: '/static/techcare-hero.webp',
  alt: 'Illustrated student volunteers helping a visitor at a technology support booth',
  steps: [
    'Intake & consent: Tell us your concern. The team records the device condition and asks for your permission before starting.',
    'Guided diagnosis: Students perform safe checks under faculty and guest technician supervision.',
    'Test & release: Review the result together, receive recommendations, and acknowledge device release.',
  ],
  preparation: [
    'Back up important files if possible.',
    'Bring your charger and relevant accessories.',
    'Unlock your device yourself. Never disclose your password.',
    'Note when the problem started and what you have tried.',
  ],
  safety:
    'We do not perform board-level or battery-cell repairs, bypass accounts, or install pirated software. Unsafe or complex cases are referred to qualified support. Stop using a device with a swollen battery or unusual heat.',
  note: 'This student project is not an official University website. Schedule, venue, scope, and visual identity require College approval.',
};
