import { useAuth } from '../auth'
import { BackLink } from '../components/Hero'

// Public page: readable without signing in (the landing page links here too).
// DRAFT: every [CONFIRM] needs a real answer before real artists use the app, and the whole text should be reviewed.
export default function Privacy() {
  const { user } = useAuth()
  return (
    <main className="legal stack">
      <BackLink to={user ? '/settings' : '/login'}>{user ? 'Back to Settings' : 'Back to sign in'}</BackLink>
      <h1>Privacy statement</h1>
      <p className="muted">Last updated 22 October 2026. Draft: items marked [CONFIRM] are still to be filled in.</p>

      <section className="card stack">
        <h2>Who runs Royalty Registry</h2>
        <p>Royalty Registry is a tool that helps independent artists record who owns what on a release, so the details are ready for distributors and collecting societies. It is run by [CONFIRM: your name or organisation]. For any privacy question, write to [CONFIRM: contact email].</p>
        <p>It is a pilot. It does not submit anything to a distributor, store or society for you, and it is general guidance, not legal or financial advice.</p>
      </section>

      <section className="card stack">
        <h2>What we store</h2>
        <ul>
          <li><strong>Your account:</strong> email address, a scrambled (hashed) password, artist name, legal name, and the profile details you choose to add, such as country, nationality, contact information, links, a profile picture, and rights-society and publisher details.</li>
          <li><strong>Your releases:</strong> songs, credits, ownership splits, release dates and store links, plus the audio and cover files you upload.</li>
          <li><strong>Co-writer details you enter:</strong> a legal name, role, share and, if you want them to confirm, an email address.</li>
          <li><strong>Co-writer notices:</strong> the invitation we email on your behalf, when it was sent, and whether it was confirmed, disputed or removed. The notice link carries a secret code, and we keep only a scrambled version of it.</li>
          <li><strong>Your preferences:</strong> email notices, and the analytics and play-count choices in Settings.</li>
          <li><strong>Sign-in:</strong> after you sign in, your browser keeps a sign-in token in its local storage for up to 7 days, or until you sign out. We do not use advertising cookies or trackers.</li>
        </ul>
        <p>We use this information only to run the features you use: showing your releases, checking they are complete, sending co-writer invitations and reminders, and letting you export your data.</p>
      </section>

      <section className="card stack">
        <h2>Who can see it</h2>
        <ul>
          <li><strong>Co-writers you credit</strong> can see the song title, their own credit and the split you entered, through their emailed link or their own account. They can confirm, dispute, or remove themselves from the credit.</li>
          <li><strong>Nobody else</strong> can see your releases, files or profile.</li>
          <li><strong>Our service providers</strong> handle data for us only to run the service: hosting at [CONFIRM: provider and country] and email sending at [CONFIRM: provider]. We do not sell your data or share it for advertising.</li>
          <li>We will share information if the law requires it. [CONFIRM: how requests would be handled]</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Co-writers who are not users</h2>
        <p>If you add someone's email to a split, we send them one message asking them to confirm their share. Their notice link expires after 14 days unless renewed. They do not need an account, and they can remove themselves or dispute the split from that page. If you are a co-writer and want your email address removed, write to [CONFIRM: contact email].</p>
      </section>

      <section className="card stack">
        <h2>Analytics</h2>
        <p>Analytics and play counts are off by default and are not collected yet. If they are added, they will only include you if you switch them on in Settings, and you can switch them off again at any time.</p>
      </section>

      <section className="card stack">
        <h2>Your choices</h2>
        <ul>
          <li><strong>See and download your data:</strong> Settings, Security and privacy, Download my data. The file has your profile, links, releases with credits, and notices. It leaves out audio, images and co-writer email addresses.</li>
          <li><strong>Correct it:</strong> change your profile, sign-in details, releases and splits at any time while a release is still a draft.</li>
          <li><strong>Delete your account:</strong> Settings, Delete account. This removes your profile, links, draft releases, uploaded files and sign-in tokens, and signs you out everywhere. Releases marked ready or released must be moved back to draft and deleted first.</li>
        </ul>
        <p>When you delete your account, a blank placeholder record remains (no name, no email, no password) because other people's records, such as a split dispute, may point to it. Where you were credited on someone else's song, the name they typed stays, but it is no longer linked to you, and any email address saved for you on that credit is cleared.</p>
        <p>Backups: [CONFIRM: whether backups exist and how long they keep deleted data]. Retention: [CONFIRM: how long inactive accounts are kept].</p>
      </section>

      <section className="card stack">
        <h2>Security</h2>
        <ul>
          <li>Passwords are stored only in hashed form, so we cannot read them.</li>
          <li>Uploaded files and releases are visible only to your signed-in account and, for the parts that concern them, to the co-writers you credit.</li>
          <li>Connections are encrypted with HTTPS. [CONFIRM once deployed]</li>
          <li>No system is perfectly secure. If a breach affects you, we will tell you and the authorities as the law requires. [CONFIRM: process and timeframe]</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Age and the law</h2>
        <p>The service is meant for adults who release music. [CONFIRM: minimum age and how a younger artist would be handled.] We aim to follow Rwanda's data protection law (Law No. 058/2021) and will update this statement if the law or the service changes. [CONFIRM: registration with the data protection authority, if needed, and an advisor or legal review.]</p>
      </section>

      <section className="card stack">
        <h2>Changes</h2>
        <p>If this statement changes in a way that matters, we will tell signed-in users in the app and update the date at the top.</p>
      </section>
    </main>
  )
}
