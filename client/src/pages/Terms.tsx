import { useAuth } from '../auth'
import { BackLink } from '../components/ui'

// Public page: readable without signing in (the register form and the landing page link here).
// This describes what the app does today. It has not had a formal legal review yet; see the note under the title.
// When the wording changes in a way users must re-accept, bump TERMS_VERSION in server/src/controllers/authController.js.
export default function Terms() {
  const { user } = useAuth()
  return (
    <main className="legal stack">
      <BackLink to={user ? '/settings' : '/register'}>{user ? 'Back to Settings' : 'Back to register'}</BackLink>
      <h1>Terms and Conditions</h1>
      <p className="muted">Last updated 17 November 2026. Track Record is a pilot, and these terms have not yet had a formal legal review.</p>

      <section className="card stack">
        <h2>About these terms</h2>
        <p>These terms are the agreement between you and the Track Record project team ("we"), an African Leadership University (ALU) capstone project run from Kigali, Rwanda, for using Track Record. By creating an account you confirm that you have read them and accept them. If you do not accept them, please do not create an account.</p>
        <p>Track Record is a pilot and is free to use. Features may change, and the service may be unavailable from time to time.</p>
      </section>

      <section className="card stack">
        <h2>What the service does, and what it does not</h2>
        <ul>
          <li>It helps you record who owns what on a release, so the details are ready for distributors and collecting societies.</li>
          <li><strong>It is not a distributor.</strong> It does not publish your music or submit anything to a store or society for you.</li>
          <li><strong>It is general guidance, not legal or financial advice.</strong> Always check the rules of your distributor and your collecting society before you rely on anything here.</li>
          <li>It does not create, transfer or prove ownership of any rights. Ownership comes from your agreements with your co-writers and the law, not just from entries in this app.</li>
          <li><strong>Estimates are estimates.</strong> Earnings figures use average rates and show a range, and playlist projections are rules of thumb. Neither is a forecast or a promise of income. Society and registration information is dated and sourced, but this sector changes quickly, so confirm it with the society itself.</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Your account</h2>
        <ul>
          <li>Give accurate details, and keep your password private. You are responsible for what happens under your account.</li>
          <li>You must be at least 18 years old to create an account.</li>
          <li>One person, one account. Do not use someone else's identity.</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Your content and your co-writers</h2>
        <ul>
          <li><strong>You keep ownership</strong> of the songs, audio, images and details you add. You give us permission only to store and show them as needed to run the service for you and the co-writers you credit.</li>
          <li>Only add music, images and details you have the right to use. Only import stream figures from your own accounts or ones you are allowed to use.</li>
          <li><strong>Splits you enter are your statements.</strong> You are responsible for their accuracy and for agreeing them with your co-writers. A co-writer who confirms, disputes or removes themselves is recorded in the app, but that is not a legal contract.</li>
          <li>When you add a co-writer's email, we send them one message on your behalf. Only add people who would reasonably expect to be contacted. Once a release is ready, a co-writer with an account can see the song's details and the name, role and share of everyone credited on it.</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>The Chrome extension</h2>
        <p>The Track Record helper copies a ready release into a distributor's form, and you review and submit it yourself. Distributors have their own terms, including terms about automation. You are responsible for following them, which is why every distributor starts switched off in the extension. The extension is an early version and may miss or misplace a field, so check every value before you submit.</p>
      </section>

      <section className="card stack">
        <h2>Using the service properly</h2>
        <p>Do not upload unlawful content or content that infringes someone else's rights, try to access other people's data, disrupt or overload the service, or use it to send spam or harass anyone. If you break these terms, we will normally warn you by email first and give you a chance to fix the problem. We may suspend an account straight away where there is a risk to other people or to the service.</p>
      </section>

      <section className="card stack">
        <h2>Ending your account</h2>
        <p>You can delete your account at any time in Settings. What is removed, and what stays, is described in the <a href="/app/privacy">Privacy statement</a>. We may also end the service or an account, and will give at least 14 days' notice by email where we can, so you have time to download your data.</p>
      </section>

      <section className="card stack">
        <h2>Our responsibility</h2>
        <p>We work to keep the service accurate and secure, but it is provided "as is" while it is a pilot. To the extent the law allows, we are not responsible for lost income, missed registrations or disputes between co-writers that arise from relying on the app. Nothing here limits any right you have that the law does not allow us to limit.</p>
      </section>

      <section className="card stack">
        <h2>Privacy</h2>
        <p>How we handle your information is explained in the <a href="/app/privacy">Privacy statement</a>, which forms part of these terms.</p>
      </section>

      <section className="card stack">
        <h2>Changes and the law</h2>
        <p>If we change these terms in a way that matters, we will tell signed-in users in the app and update the date at the top. Using the service after a change means you accept it. These terms are governed by the laws of Rwanda, and any dispute would be heard by the competent courts of Rwanda.</p>
        <p>Questions about these terms: <a href="mailto:s.dlamini2@alustudent.com">s.dlamini2@alustudent.com</a>.</p>
      </section>
    </main>
  )
}
