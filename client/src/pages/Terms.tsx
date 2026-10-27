import { useAuth } from '../auth'
import { BackLink } from '../components/Hero'

// Public page: readable without signing in (the register form and the landing page link here).
// DRAFT: every [CONFIRM] needs a real answer, and the whole text should get a legal review before real artists use the app.
// When the wording changes in a way users must re-accept, bump TERMS_VERSION in server/src/controllers/authController.js.
export default function Terms() {
  const { user } = useAuth()
  return (
    <main className="legal stack">
      <BackLink to={user ? '/settings' : '/register'}>{user ? 'Back to Settings' : 'Back to register'}</BackLink>
      <h1>Terms and Conditions</h1>
      <p className="muted">Last updated 22 October 2026. Draft: items marked [CONFIRM] are still to be filled in.</p>

      <section className="card stack">
        <h2>About these terms</h2>
        <p>These terms are the agreement between you and [CONFIRM: your name or organisation] ("we") for using Track Record. By creating an account you confirm that you have read them and accept them. If you do not accept them, please do not create an account.</p>
        <p>Track Record is a pilot. Features may change, and the service may be unavailable from time to time.</p>
      </section>

      <section className="card stack">
        <h2>What the service does, and what it does not</h2>
        <ul>
          <li>It helps you record who owns what on a release, so the details are ready for distributors and collecting societies.</li>
          <li><strong>It is not a distributor.</strong> It does not publish your music or submit anything to a store or society for you.</li>
          <li><strong>It is general guidance, not legal or financial advice.</strong> Always check the rules of your distributor and your collecting society before you rely on anything here.</li>
          <li>It does not create, transfer or prove ownership of any rights. Ownership comes from your agreements with your co-writers and the law, not from entries in this app.</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Your account</h2>
        <ul>
          <li>Give accurate details, and keep your password private. You are responsible for what happens under your account.</li>
          <li>You must be old enough to enter a binding agreement where you live. [CONFIRM: minimum age]</li>
          <li>One person, one account. Do not use someone else's identity.</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Your content and your co-writers</h2>
        <ul>
          <li><strong>You keep ownership</strong> of the songs, audio, images and details you add. You give us permission only to store and show them as needed to run the service for you and the co-writers you credit.</li>
          <li>Only add music, images and details you have the right to use.</li>
          <li><strong>Splits you enter are your statements.</strong> You are responsible for their accuracy and for agreeing them with your co-writers. A co-writer who confirms, disputes or removes themselves is recorded in the app, but that is not a legal contract.</li>
          <li>When you add a co-writer's email, we send them one message on your behalf. Only add people who would reasonably expect to be contacted.</li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Using the service properly</h2>
        <p>Do not upload unlawful content or content that infringes someone else's rights, try to access other people's data, disrupt or overload the service, or use it to send spam or harass anyone. We may suspend an account that breaks these terms. [CONFIRM: how and when you would warn the person first]</p>
      </section>

      <section className="card stack">
        <h2>Ending your account</h2>
        <p>You can delete your account at any time in Settings. What is removed, and what stays, is described in the <a href="/app/privacy">Privacy statement</a>. We may also end the service or an account, and will give reasonable notice where we can. [CONFIRM: notice period]</p>
      </section>

      <section className="card stack">
        <h2>Our responsibility</h2>
        <p>We work to keep the service accurate and secure, but it is provided "as is" while it is a pilot. To the extent the law allows, we are not responsible for lost income, missed registrations or disputes between co-writers that arise from relying on the app. Nothing here limits any right you have that the law does not allow us to limit. [CONFIRM: wording with a legal advisor]</p>
      </section>

      <section className="card stack">
        <h2>Privacy</h2>
        <p>How we handle your information is explained in the <a href="/app/privacy">Privacy statement</a>, which forms part of these terms.</p>
      </section>

      <section className="card stack">
        <h2>Changes and the law</h2>
        <p>If we change these terms in a way that matters, we will tell signed-in users in the app and update the date at the top. Using the service after a change means you accept it. These terms are governed by the laws of Rwanda. [CONFIRM: governing law, and where disputes would be heard]</p>
        <p>Questions about these terms: [CONFIRM: contact email].</p>
      </section>
    </main>
  )
}
