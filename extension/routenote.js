// Everything the helper knows about RouteNote's release form lives in this one file, so a change on their site means
// editing this file and nothing else. The patterns below are matched against each field's label, placeholder, name and id.
//
// NOT VERIFIED AGAINST THE REAL SITE. They are written from the field names RouteNote asks for (album version, compilation,
// lyrics, explicit, secondary genre, originally released, pre-order date, sales start date, contributor titles, preview start)
// and tested only on mock-distributor.html. Open RouteNote's real form once, check each label, and adjust here.
// A field that does not match is skipped and listed as "not found"; every value also has a Copy button.
const ROUTENOTE_PROFILE = {
  // text boxes and drop-downs
  albumVersion:       { re: 'album\\s*version|release\\s*version', not: 'track|song' },
  secondaryGenre:     { re: '(secondary|second)\\s*genre' },
  genre:              { re: 'primary\\s*genre|^\\s*genre', not: 'secondary|second|sub' },
  originallyReleased: { re: 'originally\\s*released|original\\s*release\\s*date' },
  preorderDate:       { re: 'pre[-\\s]?order' },
  salesStartDate:     { re: 'sales?\\s*start' },
  releaseDate:        { re: '^\\s*(digital\\s*)?release\\s*date', not: 'original|pre[-\\s]?order|sales' },
  previewStart:       { re: 'preview\\s*(start|time)|clip\\s*start' },
  previewFormat: 'mmss',            // 'mmss' sends 0:45, 'seconds' sends 45

  // yes/no style radios. `group` matches the question; `options` maps our answer to the option's visible text.
  choices: {
    isCompilation: { group: { re: 'compilation' }, options: { yes: '^\\s*yes\\b', no: '^\\s*no\\b' } },
    hasLyrics:     { group: { re: 'lyrics', not: 'language|track|song' }, options: { yes: '^\\s*yes\\b', no: '^\\s*no\\b|instrumental' } },
    // Song-level keys are separate so filling a song can never change the release's answer on a one-page form.
    trackHasLyrics: { group: { re: '(track|song)\\W.*lyrics|lyrics.*\\W(track|song)', not: 'language' }, options: { yes: '^\\s*yes\\b', no: '^\\s*no\\b|instrumental' } },
    trackExplicit:  { group: { re: '(track|song)\\W.*(explicit|parental)|(explicit|parental).*\\W(track|song)' }, options: {
      explicit: '^\\s*(yes|explicit)\\b', not_explicit: '^\\s*(no|non-?\\s*explicit|not\\s*explicit|none)\\b', cleaned: 'clean' } },
    explicit:      { group: { re: 'explicit|parental', not: 'track|song' }, options: {
      explicit: '^\\s*(yes|explicit)\\b', not_explicit: '^\\s*(no|non-?\\s*explicit|not\\s*explicit|none)\\b', cleaned: 'clean' } },
  },

  // repeating rows. `add` is the text of the "add another" button.
  lists: {
    artists:      { name: { re: 'primary\\s*artist|^\\s*artist\\s*name', not: 'track|featur|label' }, add: '^\\s*\\+?\\s*add\\s+(another\\s+)?(primary\\s+)?artist' },
    writers:      { name: { re: 'composer|songwriter|writer', not: 'publisher|ipi|share|percent|%' }, add: '^\\s*\\+?\\s*add\\s+(another\\s+)?(composer|songwriter|writer)' },
    contributors: { name: { re: 'contributor\\s*name|credit\\s*name|^\\s*name\\b', not: 'artist|composer|writer|track|release' },
                    title: { re: 'contributor\\s*(title|role)|credit\\s*(title|role)|^\\s*title\\b|^\\s*role\\b' },
                    add: '^\\s*\\+?\\s*add\\s+(another\\s+)?(contributor|credit|producer)' },
  },
}
