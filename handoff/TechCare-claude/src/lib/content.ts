export const categories = [
  'General',
  'Hardware',
  'Operating system',
  'Connectivity',
  'Online safety',
];
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
];
export const builtInResources = [
  {
    id: -1,
    title: 'Fix Wi-Fi connection problems in Windows',
    description:
      'A specific video tutorial covering basic Wi-Fi troubleshooting. Review before following the steps.',
    category: 'Connectivity',
    type: 'external',
    url: 'https://www.youtube.com/watch?v=xgVBNxeH-KU',
    author: 'Sertilink IT',
  },
  {
    id: -2,
    title: 'Five ways to care for your laptop',
    description: 'A sample device-care flyer for student review before distribution.',
    category: 'Hardware',
    type: 'image',
    url: '/static/device-care-guide.png',
    author: 'Project TechCare template',
  },
];
