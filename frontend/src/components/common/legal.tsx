import { ShieldCheck } from '@phosphor-icons/react';
import { PageHeading } from '../ui/ui';

export function Privacy() {
  return (
    <>
      <PageHeading
        title="A community built on care"
        description="How TechCare handles your information and keeps conversations useful."
      />
      <div className="privacy-document">
        <section>
          <h2>Your agreement and browser storage</h2>
          <p>
            TechCare uses your display name, email, password hash, profile details, and the content
            you submit to provide accounts, discussions, moderation, and community features. Which
            information others can see is explained below.
          </p>
          <p>
            A cookie remembers your acceptance of the current Terms of Use and this notice for up to
            one year in this browser. Other cookies maintain your sign-in session, theme, and
            navigation preference. Clearing the agreement cookie or a change to these agreements
            will require you to accept again. Clearing it does not delete your account or previously
            submitted content.
          </p>
        </section>
        <section>
          <h2>What is public</h2>
          <p>
            Your display name, approved questions, comments, replies, and their attached photos are
            public. Public profiles also show a bio and profile picture. A private profile hides
            your bio and picture from everyone except you and accepted friends.
          </p>
          <p>
            Approved Lost & Found notices show the item, photos, description, location, date, and
            report number. They do not expose your identity or contact details.
          </p>
        </section>
        <section>
          <h2>What stays private</h2>
          <p>
            Your email is used for account access and recovery. Administrators can see account
            emails for role management. Feedback is visible with your identity to moderators and
            administrators, and is not anonymous.
          </p>
          <p>
            Only accepted friends can read or send messages in their conversation. Removing a
            friendship or blocking stops access. Stored messages are retained; becoming friends
            again can restore access to previous messages.
          </p>
          <p>
            Lost & Found inquiries and replies are visible only to the sender, the item reporter,
            and the project team. Public notices do not show your contact details.
          </p>
        </section>
        <section>
          <h2>Report and block</h2>
          <p>
            Use Report under a discussion question or comment to send it to moderators for review.
            Authors can edit or remove their own comments; member edits are reviewed again.
          </p>
          <p>
            Use the flag beside a received message to report it. Staff can review the reported
            message and your reason, but cannot browse your whole conversation. Use Block on a
            member’s profile card or in a conversation to revoke friendship and communication
            access.
          </p>
        </section>
        <section>
          <h2>Keep it helpful</h2>
          <ul>
            <li>Be respectful and keep questions relevant to technology support.</li>
            <li>
              Do not share passwords, private identifiers, or someone else’s personal information.
            </li>
            <li>
              Give safe advice. Do not suggest account bypass, pirated software, or unsafe repairs.
            </li>
            <li>Credit original creators when sharing resources.</li>
          </ul>
          <p>
            Questions, member replies, and Lost & Found reports are reviewed before publication.
            Moderators may reject inappropriate or unsafe submissions.
          </p>
        </section>
        <section className="callout">
          <ShieldCheck size={25} />
          <div>
            <h2>Local pilot notice</h2>
            <p>
              TechCare is a student community service learning project, not an official University
              website. This notice describes the pilot’s behavior. Responsible privacy contacts,
              retention and deletion periods, appeals, and incident procedures must be approved
              before public operation. Use synthetic information for local demonstrations.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export function Terms() {
  return (
    <>
      <PageHeading
        title="Terms of Use"
        description="The ground rules for taking part in TechCare."
      />
      <div className="privacy-document">
        <section>
          <h2>About TechCare</h2>
          <p>
            TechCare is a student community service learning project for technology support. It is
            not an official University website. This pilot is intended for local demonstrations
            using synthetic information.
          </p>
        </section>
        <section>
          <h2>Your account and contributions</h2>
          <p>
            Keep your sign-in details secure. Share only content you have permission to publish, and
            leave out passwords, private identifiers, and other people’s personal information. Your
            display name and approved discussion contributions, including attached photos, are
            public even when your profile is private.
          </p>
        </section>
        <section>
          <h2>Community rules</h2>
          <ul>
            <li>Be respectful and keep questions relevant to technology support.</li>
            <li>Do not post harassment, spam, impersonation, or harmful content.</li>
            <li>Do not recommend account bypass, pirated software, or unsafe repairs.</li>
            <li>Credit original creators when sharing resources.</li>
          </ul>
          <p>
            Moderators review questions, member comments and edits, and Lost &amp; Found reports
            before publication. They may reject inappropriate or unsafe submissions. Use the
            reporting tools to raise concerns.
          </p>
        </section>
        <section>
          <h2>Using community advice</h2>
          <p>
            Suggestions come from community members and may not fit your device or situation. Start
            with safe checks and ask the support booth for help when you are unsure. Stop if you
            notice damage, unusual heat, or a swollen battery.
          </p>
        </section>
        <section>
          <h2>Privacy and acceptance</h2>
          <p>
            Read the <a href="/privacy">Privacy Notice</a> for details about account information,
            public content, private messages, and the pilot’s limitations. Access to app features
            requires acceptance of both agreements. You may read these documents without accepting.
            If you do not agree, leave the site.
          </p>
        </section>
      </div>
    </>
  );
}
