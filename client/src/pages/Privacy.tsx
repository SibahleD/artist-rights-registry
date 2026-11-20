import { useAuth } from '../auth'
import { BackLink } from '../components/ui'

// Public page: readable without signing in (the landing page links here too).
// Keep this in step with client/landing/privacy.html, which carries the same text for the website.
// It describes what the code does today. If a feature starts storing or sharing something new, change this page too.
export default function Privacy() {
  const { user } = useAuth()
  return (
    <main className="legal stack">
      <BackLink to={user ? '/settings' : '/login'}>{user ? 'Back to Settings' : 'Back to sign in'}</BackLink>
      <h1>Privacy statement</h1>
      <p className="muted">Last updated 17 November 2026. Track Record is a pilot, and this statement has not yet had a formal legal review.</p>

      <section className="card stack">
        <h2>Who runs Track Record</h2>
        <p>Track Record is a tool that helps independent artists record who owns what on a release, so the details are ready for distributors and collecting societies. It is an African Leadership University (ALU) capstone project, run from Kigali, Rwanda, by the project team ("we"). For any privacy question, write to <a href="mailto:s.dlamini2@alustudent.com">s.dlamini2@alustudent.com</a>.</p>
        <p>It is a pilot. It does not submit anything to a distributor, store or society for you, and it is general guidance, not legal or financial advice.</p>
      </section>

      <section className="card stack">
        <h2>What we store</h2>
        <ul>
          <li><strong>Your account:</strong> email address, a scrambled (hashed) password, artist name, legal name, an optional username, and the profile details you choose to add, such as country, nationality, roles, links, a profile picture, and rights-society, IPI and publisher details. We also record when you accepted the Terms and which version.</li>
          <li><strong>Your releases:</strong> songs, credits, whether a song has lyrics, copyright lines, ownership splits, codes such as ISRC and UPC, release dates and store links, plus the audio and cover files you upload. For audio we also keep technical details such as format, length and bitrate.</li>
          <li><strong>Sound settings:</strong> if you use playlist projections, the energy, danceability and mood settings you choose for a song. They are used only to work out the projection on your own screen.</li>
          <li><strong>Co-writer details you enter:</strong> a legal name, role, share and, if you want them to confirm, an email address and IPI number.</li>
          <li><strong>Co-writer notices:</strong> the invitation we email on your behalf, when it was sent, and whether it was confirmed, disputed or removed. The notice link carries a secret code, and we keep only a scrambled version of it.</li>
          <li><strong>Stream figures you import:</strong> the daily listener, stream, playlist-add, save and follower figures from Spotify for Artists audience files you import, any per-song stream figures (by song code, platform and month) loaded into your account, and a log of each import with its file name. We keep the figures, not the file itself. You choose what to import.</li>
          <li><strong>Glossary progress:</strong> which glossary terms you marked as understood.</li>
          <li><strong>Society registrations:</strong> the collecting societies you chose to track, with your status for each, an optional registration date and an optional member number. Only you can see this list.</li>
          <li><strong>Your preferences:</strong> email notices, and the analytics and play-count choices in Settings.</li>
          <li><strong>Sign-in and security:</strong> after you sign in, your browser keeps a sign-in token in its local storage for up to 7 days, or until you sign out. Email verification and password reset links also carry secret codes, and we keep only a scrambled version of each. Our hosting provider and our rate limits see your IP address when you use the service, to keep it running and to block abuse.</li>
        </ul>
        <p>We do not use advertising cookies or trackers. We use this information only to run the features you use: showing your releases, checking they are complete, sending co-writer invitations and reminders, showing your stream figures and estimates, and letting you export your data.</p>
      </section>

      <section className="card stack">
        <h2>Who can see it</h2>
        <ul>
          <li><strong>Co-writers you credit.</strong> Through their emailed link, a co-writer sees the song title, their own role and share, and the options to confirm, dispute or remove themselves. If they have an account, then once the release is ready they can also open the song and see its details (title, release, artist, release date and codes) and the legal name, role and share of everyone credited on it.</li>
          <li><strong>Nobody else</strong> can see your releases, files, stream figures, society list or profile.</li>
          <li><strong>Our service providers</strong> handle data for us only to run the service: Netlify (hosting and the API), Supabase (database and audio storage) and a third-party email service (sending verification, reset and co-writer emails). We do not sell your data or share it for advertising.</li>
          <li><strong>The law.</strong> We will share information if a court or authority legally requires it, and only what is required.</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Co-writers who are not users</h2>
        <p>If you add someone's email to a split, we send them one message asking them to confirm their share. They do not need an account, and they can remove themselves or dispute the split from that page. Their notice link expires after 14 days unless renewed. If they have not answered by then, we delete the email address and name we held for the notice. If they do answer, we keep their details while the song is on the platform, as the message tells them. If you are a co-writer and want your email address removed, write to <a href="mailto:s.dlamini2@alustudent.com">s.dlamini2@alustudent.com</a>.</p>
      </section>

      <section className="card stack">
        <h2>Analytics</h2>
        <p>Analytics and play counts are off by default and are not collected yet. The two switches in Settings only record your choice. If collection is added later, it will only include you if you have switched it on, and you can switch it off again at any time.</p>
      </section>

      <section className="card stack">
        <h2>Where your data is kept</h2>
        <p>Your data is stored with Netlify and Supabase, and emails pass through our email service. Their servers may be outside Rwanda, so your data may be processed in other countries. We choose providers that keep data protected, and we send them only what the service needs.</p>
      </section>

      <section className="card stack">
        <h2>Your choices</h2>
        <ul>
          <li><strong>See and download your data:</strong> Settings, Preferences, Security and privacy, Download my data. The file has your profile and preferences, links, releases with credits, notices you sent, songs you are credited on, glossary progress and your society list. It leaves out audio, images, co-writer email addresses and imported stream figures.</li>
          <li><strong>Correct it:</strong> change your profile, sign-in details, releases and splits at any time while a release is still a draft. You can clear your imported Spotify audience figures, or remove an import, on the Metrics page.</li>
          <li><strong>Delete your account:</strong> Settings, Account, Delete account. This removes your profile, links, draft releases, uploaded files, imported stream and audience figures, society list, glossary progress and sign-in tokens, and signs you out everywhere. Releases marked ready or released must be moved back to draft and deleted first.</li>
        </ul>
        <p>When you delete your account, a blank placeholder record remains (no name, no email, no password) because other people's records, such as a split dispute, may point to it. Where you were credited on someone else's song, the name they typed stays, but it is no longer linked to you, and any email address saved for you on that credit is cleared.</p>
        <p>Our database host may keep routine backups, and deleted data can remain in them until they expire. We do not delete inactive accounts automatically during the pilot. You can delete yours at any time.</p>
      </section>

      <section className="card stack">
        <h2>Security</h2>
        <ul>
          <li>Passwords are stored only in hashed form, so we cannot read them. Changing your password signs your other devices out.</li>
          <li>Audio is kept in a private bucket and played back through short-lived links. Uploaded files and releases are visible only to your signed-in account and, for the parts that concern them, to the co-writers you credit.</li>
          <li>Connections are encrypted with HTTPS.</li>
          <li>No system is perfectly secure. If a breach affects you, we will tell you and the authorities as the law requires.</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Age and the law</h2>
        <p>The service is meant for adults, and you must be at least 18 to create an account. If we learn that an account belongs to someone younger, we may close it. We aim to follow Rwanda's data protection law (Law No. 058/2021) and will update this statement if the law or the service changes.</p>
      </section>

      <section className="card stack">
        <h2>Changes</h2>
        <p>If this statement changes in a way that matters, we will tell signed-in users in the app and update the date at the top.</p>
      </section>
    </main>
  )
}
