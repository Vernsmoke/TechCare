/** Public product help only. Keep this in sync with the implemented screens. */
export type HelpTopic = {
  id: string;
  question: string;
  matches: RegExp[];
  answer: string;
  steps: string[];
  link?: { href: string; label: string };
};

export const helpTopics: HelpTopic[] = [
  {
    id: 'question-photo',
    question: 'How do I add a photo to my question?',
    matches: [
      /\b(camera|capture|retake|screenshot)\b/,
      /\b(photo|image|picture|attachment)\b.*\b(question|post|attach)\b/,
      /\b(question|post|attach)\b.*\b(photo|image|picture)\b/,
    ],
    answer:
      'In Ask a Question, use Upload photo or Use camera to add one optional picture. Preview it, replace or retake it, or remove it before submitting. The photo stays private to you and staff until your question is approved, then becomes public with the question.',
    steps: [
      'Sign in and open Ask a Question. Add your title, category, and problem description.',
      'Select Upload photo for a PNG, JPEG, or WebP image, or select Use camera and allow camera permission.',
      'For the live camera, frame the problem and choose Capture photo. Retake or remove it if needed. Camera access needs HTTPS or localhost; a device photo picker is available if live camera access fails.',
      'Hide passwords and private details. Choose Submit for review. Photos are resized and uploaded only when you submit.',
    ],
    link: { href: '/discussion', label: 'Open Discussion' },
  },
  {
    id: 'assistant',
    question: 'What can you help with?',
    matches: [
      /\b(chatbot|assistant|chatgpt|openai|api|ai|bot)\b/,
      /what can you|who are you|are you human|how do you work/,
    ],
    answer:
      'I’m TechCare’s built-in help assistant. I can explain how this website works and share troubleshooting guides. My replies come from the project’s help content, without a ChatGPT account or paid AI service. I cannot view your account, perform actions for you, or answer every general-knowledge question.',
    steps: [
      'Ask about accounts, discussions, friends, messages, privacy, resources, or the support booth.',
      'After an answer, ask “Show me the steps” for more detail.',
      'Use Ask the community for a question that needs a person.',
    ],
  },
  {
    id: 'deletion',
    question: 'How do I delete my account?',
    matches: [/\b(delete|remove|erase|close)\b.*\b(account|data)\b/],
    answer:
      'This pilot does not have a self-service account deletion feature. The team operating TechCare needs to handle deletion requests and define its retention policy. I cannot delete your account or stored data.',
    steps: [
      'Use Feedback to raise the request with the operating team without including passwords.',
      'Read the pilot privacy notice for the current limitations.',
      'Clear chat only erases this assistant’s local conversation; it does not delete your TechCare account.',
    ],
    link: { href: '/privacy', label: 'Read the pilot privacy notice' },
  },
  {
    id: 'recovery',
    question: 'How do I reset my password?',
    matches: [
      /\b(forgot|reset|recover|change|lost)\b.*\b(password|account|access)\b/,
      /\bpassword\b.*\b(forgot|reset|recover|change|lost)\b/,
    ],
    answer:
      'You can reset a forgotten password from Sign In. Recovery instructions are sent to your account email when email delivery is configured. I cannot retrieve your password or inspect your account.',
    steps: [
      'Open Sign In and select Forgot password?.',
      'Enter your account email and choose Send recovery instructions.',
      'Choose Reset password with a token, enter the recovery token and a new password of 12–128 characters.',
      'Sign in again. A successful reset ends your existing sessions. Never send the token to this chat.',
    ],
  },
  {
    id: 'verification',
    question: 'How do I verify my email?',
    matches: [
      /\b(verify|verification|code|otp|resend|activate)\b/,
      /email.*(arriv|receiv|deliver)/,
    ],
    answer:
      'New accounts need email verification before sign-in. Use the six-digit code from your verification message. In the local classroom demo, the interface may display a demonstration code; real email delivery requires the operator’s mail setup.',
    steps: [
      'Open Sign In, then Verify a pending account.',
      'Enter your email and six-digit code, then choose Verify email.',
      'If you need another code, enter your email under Email for a new code and choose Send a new code. Respect any cooldown shown.',
      'Check spam folders for real delivery. If email is not configured, the team operating this app needs to enable it. Do not post your code here.',
    ],
  },
  {
    id: 'registration',
    question: 'How do I create an account?',
    matches: [/\b(register|registration|signup|sign up|join|create account)\b/, /create.*account/],
    answer:
      'Choose Create Account at the top of the page. You’ll need a display name, email, and a password of 12–128 characters. Verify your email, then sign in. Your display name appears on approved public contributions.',
    steps: [
      'Select Create Account.',
      'Fill in Display name, Email address, and Password, then submit.',
      'Complete email verification using the six-digit code.',
      'Return to Sign In and use your email and password.',
    ],
    link: { href: '/privacy', label: 'Read privacy & community guidelines' },
  },
  {
    id: 'blocking',
    question: 'How do I report or block someone?',
    matches: [
      /\b(block|blocked|blocking|unblock|harass|abuse)\b/,
      /report.*(message|member|someone|person)/,
    ],
    answer:
      'You can block a member from their member card or your conversation. Blocking removes friendship and stops communication access. To report a received message, use its flag button. Staff receive that reported message and your reason, not unrestricted access to the whole conversation.',
    steps: [
      'Open Members and find the person, or open your conversation.',
      'Use Block to stop communication.',
      'For a received message, select Report this message, explain the reason, and send the report.',
    ],
    link: { href: '/members', label: 'Open Members' },
  },
  {
    id: 'following',
    question: 'Is following the same as being friends?',
    matches: [/\b(follow|following|followers|unfollow)\b/],
    answer:
      'Following and friendship are separate. Following keeps a member in your dashboard. Accepted friendship lets you message each other and view each other’s private profile bio and picture. Following alone does not grant those permissions.',
    steps: [
      'Open Members and find a member.',
      'Select Follow to add them to your following list.',
      'For messaging, send a friend request and wait for acceptance. You can review relationships in My Dashboard.',
    ],
    link: { href: '/members', label: 'Find members' },
  },
  {
    id: 'messaging',
    question: 'How do I send a message?',
    matches: [/\b(message|messages|messaging|dm|inbox|conversation|chat)\b/],
    answer:
      'Private messaging is available between accepted friends. Sign in, open Members, and select Message on an accepted friend’s card. This feature is separate from this help assistant and is not a live chat service.',
    steps: [
      'Open Members and find the person.',
      'If you are not friends yet, send a friend request and wait for acceptance.',
      'Choose Message, write in New message, and select Send message.',
      'Removing the friendship or blocking stops conversation access. Stored history may become accessible again if you become friends again.',
    ],
    link: { href: '/members', label: 'Open Members' },
  },
  {
    id: 'friends',
    question: 'How do friend requests work?',
    matches: [/\b(friend|friends|friendship|unfriend|members|people|directory)\b/],
    answer:
      'Find people in Members and send a friend request. The recipient must accept before you can exchange private messages. A private profile’s bio and picture are visible to its owner and accepted friends.',
    steps: [
      'Sign in and open Members.',
      'Find a person and send a friend request.',
      'Incoming requests show Accept request. Outgoing requests remain pending until accepted.',
      'Once accepted, use Message. You can remove friendship or block when needed.',
    ],
    link: { href: '/members', label: 'Browse Members' },
  },
  {
    id: 'privacy',
    question: 'Who can see my information?',
    matches: [
      /\b(privacy|private|personal|data|confidential|anonymous)\b/,
      /who can (see|read)|hide my|visible to/,
    ],
    answer:
      'Your display name and approved discussion contributions are public. A private profile hides your bio and picture except from you and accepted friends. Feedback is staff-only but is not anonymous. This assistant does not inspect your profile or messages; its chat history stays in the tab’s memory.',
    steps: [
      'Open My Dashboard to change Profile visibility.',
      'Keep passwords, verification codes, and private identifiers out of public posts.',
      'Read Privacy & community guidelines for messaging, reports, and pilot limitations.',
      'Use Clear chat to erase this assistant’s conversation. Refreshing or changing accounts also clears it.',
    ],
    link: { href: '/privacy', label: 'Read privacy & community guidelines' },
  },
  {
    id: 'profile',
    question: 'How do I edit my profile?',
    matches: [/\b(profile|dashboard|avatar|picture|bio|display name)\b/],
    answer:
      'Sign in and open My Dashboard to change your display name, profile visibility, bio, and picture. Select Save profile to apply changes.',
    steps: [
      'Sign in, then choose My Dashboard in the navigation.',
      'Edit Display name, Profile visibility, About me, or Profile picture.',
      'Select Save profile and check the confirmation. A private profile still has a public display name and public approved posts.',
    ],
    link: { href: '/profile', label: 'Open My Dashboard' },
  },
  {
    id: 'moderation',
    question: 'Why is my question waiting for review?',
    matches: [
      /\b(review|pending|approve|approved|approval|moderator|moderation|rejected|admin|administrator|roles)\b/,
      /post.*(not showing|not visible|disappear)/,
    ],
    answer:
      'Questions, member replies, and Lost & Found notices are reviewed before publication. Moderators can approve or reject submissions. Administrators manage moderator roles. I cannot see a submission’s status, approve it, or promise a review time.',
    steps: [
      'Make sure you saw the submission confirmation.',
      'Avoid repeatedly submitting the same content while it is awaiting review.',
      'Keep contributions relevant, respectful, and free of sensitive information.',
      'Approved discussions appear in Discussion; reviewed notices appear in Lost & Found.',
    ],
    link: { href: '/discussion', label: 'Open Discussion' },
  },
  {
    id: 'discussion',
    question: 'How do I ask the community?',
    matches: [
      /\b(discussion|post|posts|question|questions|reply|replies|comment|forum|community)\b/,
    ],
    answer:
      'Discussion is where you ask the community for technology help. Choose Ask a Question, add a title, category, and description, then submit for review. Members’ replies also go through review before publication.',
    steps: [
      'Sign in and choose Ask a Question.',
      'Write a clear title, select a category, and describe your device, the problem, and checks you tried.',
      'Leave out passwords and personal identifiers, then choose Submit for review.',
      'Browse approved topics in Discussion. Open a question to read comments or submit your own. Signed-in members can upvote or downvote questions and comments; click the same vote again to remove it.',
    ],
    link: { href: '/discussion', label: 'Browse Discussion' },
  },
  {
    id: 'lostfound',
    question: 'How do I report a lost item?',
    matches: [/\b(lost|found|missing|item|belongings)\b/],
    answer:
      'Lost & Found lists approved notices. Sign in and choose Report an item to submit a lost or found item for review. Published notices do not expose the reporter’s identity or contact details.',
    steps: [
      'Open Lost & Found and check existing notices.',
      'Select Report an item and choose lost or found.',
      'Enter the item, location, and a useful public description without private contact details or serial numbers.',
      'Choose Send for review. The assistant cannot verify ownership or arrange a handover.',
    ],
    link: { href: '/lostfound', label: 'Open Lost & Found' },
  },
  {
    id: 'resources',
    question: 'Where are the videos and learning materials?',
    matches: [/\b(video|videos|media|resource|resources|tutorial|tutorials|upload|publish)\b/],
    answer:
      'Videos & Media contains credited learning resources with category filters. Moderators can publish resources. Administrators can add, edit, publish, hide, and delete guides, media, and booth details under Admin → Page content; regular members browse published content. Some links open an external website.',
    steps: [
      'Open Videos & Media.',
      'Choose a category and select a resource to view.',
      'Staff can publish resources from their moderator tools, subject to the app’s file and link checks.',
    ],
    link: { href: '/resources', label: 'Explore Videos & Media' },
  },
  {
    id: 'feedback',
    question: 'How do I send feedback?',
    matches: [/\b(feedback|suggestion|rating|rate|complaint|bug)\b/],
    answer:
      'Sign in and use Feedback to rate your experience and share what could improve. Moderators and administrators can see your feedback and identity; it is not an anonymous public review.',
    steps: [
      'Open Feedback while signed in.',
      'Select a rating and describe what worked well or what could improve.',
      'Select Send feedback. For a bug, include what you were doing and what you expected, without passwords or private information.',
    ],
    link: { href: '/feedback', label: 'Send feedback' },
  },
  {
    id: 'booth',
    question: 'Where is the support booth?',
    matches: [
      /\b(booth|human|person|technician|schedule|hours|venue|visit|appointment|booking|repair|contact)\b/,
    ],
    answer:
      'The Support Booth page describes published campus activities and their support process. Check that page for the latest dates, venue, hours, and activity notices. This app does not book appointments or create repair tickets.',
    steps: [
      'Open Support Booth and check the current approval notice and listed details.',
      'Before visiting, back up important files if possible and bring your charger.',
      'Note the symptoms and checks you tried. Unlock the device yourself rather than sharing your password.',
      'Unsafe or complex repairs need qualified support.',
    ],
    link: { href: '/booth', label: 'Visit Support Booth' },
  },
  {
    id: 'login',
    question: 'How do I sign in?',
    matches: [/\b(sign in|signin|log in|login|log out|logout|sign out|account|password|access)\b/],
    answer:
      'Use Sign In at the top of the page with your verified account email and password. Once signed in, My Dashboard and account actions appear in the navigation. Use Sign out when you finish on a shared device.',
    steps: [
      'Choose Sign In and enter your email and password.',
      'If your email is not verified, choose Verify a pending account.',
      'If you forgot your password, choose Forgot password?.',
      'After signing in, use the navigation to open My Dashboard.',
    ],
  },
  {
    id: 'about',
    question: 'What is TechCare?',
    matches: [
      /\b(techcare|website|web app|platform|purpose|features|navigate|navigation|start|cost|free|payment)\b/,
    ],
    answer:
      'TechCare is a student community technology-support portal. It brings together troubleshooting guides, learning media, moderated discussions, member connections, Lost & Found, feedback, and support-booth information. It is a local pilot, not an official University website.',
    steps: [
      'Browse Home, Troubleshooting Guides, Videos & Media, and approved community content.',
      'Create and verify an account to contribute, connect with members, and send feedback.',
      'Check Support Booth for the planned campus activity. There is no payment or appointment-booking feature.',
      'This built-in assistant requires no personal ChatGPT account, API key, or AI usage fees.',
    ],
    link: { href: '/', label: 'Go to Home' },
  },
];

export const helpSuggestions = [
  'What is TechCare?',
  'How do I create an account?',
  'How do I send a message?',
  'What can you help with?',
];
