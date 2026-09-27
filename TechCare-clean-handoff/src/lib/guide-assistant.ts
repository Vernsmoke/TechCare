import { guides as defaultGuides } from './content';
import type { Guide } from './types';
import { helpSuggestions, helpTopics, type HelpTopic } from './assistant-knowledge';

export type GuideReply = {
  text: string;
  guide?: Guide;
  choices?: string[];
  link?: { href: string; label: string };
  topic?: string;
  steps?: string[];
};

const topics = [
  {
    icon: 'desktop',
    pattern: /\b(slow|sluggish|startup|performance|lag|lagging|storage|windows)\b/,
  },
  {
    icon: 'wifi',
    pattern: /\b(wi[ -]?fi|internet|network|connection|connectivity|router|offline)\b/,
  },
  {
    icon: 'laptop',
    pattern: /\b(turn on|power|charger|charging|battery|black screen|won t start)\b/,
  },
  { icon: 'shield', pattern: /\b(suspicious|phishing|scam|fraud|spam|safety|hacked|malicious)\b/ },
];

function topicReply(topic: HelpTopic, detailed = false): GuideReply {
  return {
    text: topic.answer,
    topic: topic.id,
    link: topic.link,
    steps: detailed ? topic.steps : undefined,
    choices: detailed ? undefined : ['Show me the steps'],
  };
}

// Authored app knowledge and guides only: no account access, model, or remote request.
export function getGuideReply(
  message: string,
  previousTopic?: string,
  guides: Guide[] = defaultGuides,
): GuideReply {
  const text = message.toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(swollen|swelling|burning|smoke|sparks|overheating|too hot)\b/.test(text)) {
    return {
      text: 'Stop using the device if its battery is swollen, it is unusually hot, or there is a burning smell. Seek qualified support instead of trying further troubleshooting.',
      link: { href: '/booth', label: 'Find support' },
    };
  }
  if (/^(thanks|thank you|thankyou|salamat)[!. ]*$/.test(text)) {
    return {
      text: 'You’re welcome! What else would you like to know about TechCare?',
      topic: previousTopic,
    };
  }
  if (/^(hi|hello|hey|help)[!.? ]*$/.test(text)) {
    return {
      text: 'Hello! Ask me about using TechCare or troubleshooting a device. You can start with one of these questions.',
      choices: helpSuggestions,
    };
  }
  if (
    /^(show me (the )?steps|steps|tell me more|more details|how( do i do (that|it))?|what next|where( do i find (that|it))?)[!.? ]*$/.test(
      text,
    )
  ) {
    const topic = helpTopics.find((item) => item.id === previousTopic);
    if (topic) return topicReply(topic, true);
    const guide = guides.find((guide) => previousTopic === `guide-${guide.id}`);
    if (guide)
      return {
        text: 'Here are the guide steps again. Work through the checks in order:',
        guide,
        topic: previousTopic,
      };
    return { text: 'Which part of TechCare would you like help with?', choices: helpSuggestions };
  }
  if (
    /\b(still|didn t|doesn t|did not|does not|not)\b.*\b(work|working|help|helped|fixed|solved)\b|no luck/.test(
      text,
    )
  ) {
    return {
      text: 'Let’s get you more specific help. Use Ask the community and describe what you tried and what happened. I cannot inspect your account or device, so I cannot confirm the cause or make changes for you.',
      link: { href: '/discussion', label: 'Open Discussion' },
    };
  }
  const namedTopic = helpTopics.find((topic) => topic.question.toLowerCase() === text);
  if (namedTopic) return topicReply(namedTopic);
  const exact = guides.find((guide) => guide.title.toLowerCase() === message.trim().toLowerCase());
  const matchedIcons = topics
    .filter((topic) => topic.pattern.test(text))
    .map((topic) => topic.icon);
  const matches = guides.filter((guide) => matchedIcons.includes(guide.icon));
  if (exact || matches.length === 1) {
    const guide = exact || matches[0];
    return {
      text: 'Here are the steps from our guide. Start with the first check:',
      guide,
      topic: `guide-${guide.id}`,
    };
  }
  if (matches.length > 1)
    return {
      text: 'I found a few possible guides. Which problem would you like to check first?',
      choices: matches.map((guide) => guide.title),
    };
  const topic = helpTopics.find((item) => item.matches.some((pattern) => pattern.test(text)));
  if (topic) return topicReply(topic);
  return {
    text: 'I don’t have a reliable answer for that in TechCare’s help content yet. I can explain the app’s features or share device guides. Try one of these questions, rephrase with a feature name, or ask the community for help.',
    choices: helpSuggestions,
    link: { href: '/discussion', label: 'Browse community discussions' },
  };
}
