export const categories = [
  'General',
  'Hardware',
  'Operating system',
  'Connectivity',
  'Online safety',
];
export { guides } from '../../../shared/src/content-defaults.mjs';
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
