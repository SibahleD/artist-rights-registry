export function RightsDiagram() {
  return (
    <svg className="rd" viewBox="0 0 440 210" role="img" aria-label="One song splits into two sets of rights: the recording, identified by an ISRC, and the composition, identified by an ISWC.">
      <defs>
        <marker id="rd-arrow-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className="rd-head" /></marker>
      </defs>
      <rect className="rd-node" x="140" y="8" width="160" height="44" rx="10" />
      <text className="rd-text rd-strong" x="220" y="35" textAnchor="middle">One song</text>

      <path className="rd-line rec" d="M190 52 L110 98" markerEnd="url(#rd-arrow-a)" />
      <path className="rd-line comp" d="M250 52 L330 98" markerEnd="url(#rd-arrow-a)" />

      <rect className="rd-node rec" x="10" y="100" width="200" height="98" rx="10" />
      <text className="rd-text rd-strong" x="110" y="126" textAnchor="middle">The recording</text>
      <text className="rd-text rd-sub" x="110" y="150" textAnchor="middle">One captured performance</text>
      <text className="rd-text rd-sub" x="110" y="170" textAnchor="middle">Code: ISRC</text>
      <text className="rd-text rd-sub" x="110" y="188" textAnchor="middle">Owner: who made or paid</text>

      <rect className="rd-node comp" x="230" y="100" width="200" height="98" rx="10" />
      <text className="rd-text rd-strong" x="330" y="126" textAnchor="middle">The composition</text>
      <text className="rd-text rd-sub" x="330" y="150" textAnchor="middle">The melody and the words</text>
      <text className="rd-text rd-sub" x="330" y="170" textAnchor="middle">Code: ISWC</text>
      <text className="rd-text rd-sub" x="330" y="188" textAnchor="middle">Owner: writers, publisher</text>
    </svg>
  )
}

export function MoneyFlowDiagram() {
  return (
    <svg className="rd rd-tall" viewBox="0 0 440 372" role="img" aria-label="When a listener streams a song, the streaming app pays twice. Recording money goes to your distributor and then to you. Song money goes to a collecting society and then to writers and publishers, but only if the song is registered.">
      <defs>
        <marker id="rd-arrow-b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" className="rd-head" /></marker>
      </defs>
      <rect className="rd-node" x="110" y="6" width="220" height="40" rx="10" />
      <text className="rd-text rd-strong" x="220" y="31" textAnchor="middle">A listener streams your song</text>
      <path className="rd-line" d="M220 46 L220 68" markerEnd="url(#rd-arrow-b)" />

      <rect className="rd-node" x="110" y="70" width="220" height="40" rx="10" />
      <text className="rd-text rd-strong" x="220" y="95" textAnchor="middle">The app pays twice</text>

      <path className="rd-line rec" d="M170 110 L110 152" markerEnd="url(#rd-arrow-b)" />
      <path className="rd-line comp" d="M270 110 L330 152" markerEnd="url(#rd-arrow-b)" />

      <rect className="rd-node rec" x="10" y="154" width="200" height="64" rx="10" />
      <text className="rd-text rd-strong" x="110" y="180" textAnchor="middle">Recording money</text>
      <text className="rd-text rd-sub" x="110" y="202" textAnchor="middle">to your distributor</text>
      <rect className="rd-node comp" x="230" y="154" width="200" height="64" rx="10" />
      <text className="rd-text rd-strong" x="330" y="180" textAnchor="middle">Song money</text>
      <text className="rd-text rd-sub" x="330" y="202" textAnchor="middle">to a collecting society</text>

      <path className="rd-line rec" d="M110 218 L110 250" markerEnd="url(#rd-arrow-b)" />
      <path className="rd-line comp rd-dash" d="M330 218 L330 250" markerEnd="url(#rd-arrow-b)" />

      <rect className="rd-node rec" x="10" y="252" width="200" height="52" rx="10" />
      <text className="rd-text rd-strong" x="110" y="276" textAnchor="middle">You</text>
      <text className="rd-text rd-sub" x="110" y="294" textAnchor="middle">after any fee</text>
      <rect className="rd-node comp" x="230" y="252" width="200" height="52" rx="10" />
      <text className="rd-text rd-strong" x="330" y="276" textAnchor="middle">Writers and publishers</text>
      <text className="rd-text rd-sub" x="330" y="294" textAnchor="middle">by their shares</text>

      <rect className="rd-note" x="230" y="318" width="200" height="46" rx="10" />
      <text className="rd-text rd-warn" x="330" y="338" textAnchor="middle">Only if the song is</text>
      <text className="rd-text rd-warn" x="330" y="355" textAnchor="middle">registered and matches</text>
    </svg>
  )
}
