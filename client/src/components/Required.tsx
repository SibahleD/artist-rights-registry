// The asterisk that marks a detail the release needs before it can be marked ready.
export const Req = () => <span className="req" title="Needed before the release can be marked ready" aria-label="(needed)"> *</span>

export const RequiredNote = () => (
  <p className="hint required-note"><span className="req" aria-hidden="true">*</span> marks what a release needs before it can be marked ready. Everything else is optional, but distributors usually ask for it.</p>
)
