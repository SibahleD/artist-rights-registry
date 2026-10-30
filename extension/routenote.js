const ROUTENOTE_PROFILE = {
  albumVersion:       { re: 'album\\s*version|release\\s*version', not: 'track|song' },
  secondaryGenre:     { re: '(secondary|second)\\s*genre' },
  genre:              { re: 'primary\\s*genre|^\\s*genre', not: 'secondary|second|sub' },
  originallyReleased: { re: 'originally\\s*released|original\\s*release\\s*date' },
  preorderDate:       { re: 'pre[-\\s]?order' },
  salesStartDate:     { re: 'sales?\\s*start' },
  releaseDate:        { re: '^\\s*(digital\\s*)?release\\s*date', not: 'original|pre[-\\s]?order|sales' },
  previewStart:       { re: 'preview\\s*(start|time)|clip\\s*start' },
  previewFormat: 'mmss', 
  
  choices: {
    isCompilation: { group: { re: 'compilation' }, options: { yes: '^\\s*yes\\b', no: '^\\s*no\\b' } },
    hasCoverVersions: { group: { re: 'cover\\s*version' }, options: { yes: '^\\s*yes\\b', no: '^\\s*no\\b' } },
    hasLyrics:     { group: { re: 'lyrics', not: 'language|track|song' }, options: { yes: '^\\s*yes\\b', no: '^\\s*no\\b|instrumental' } },
    trackHasLyrics: { group: { re: '(track|song)\\W.*lyrics|lyrics.*\\W(track|song)', not: 'language' }, options: { yes: '^\\s*yes\\b', no: '^\\s*no\\b|instrumental' } },
    trackExplicit:  { group: { re: '(track|song)\\W.*(explicit|parental)|(explicit|parental).*\\W(track|song)' }, options: {
      explicit: '^\\s*(yes|explicit)\\b', not_explicit: '^\\s*(no|non-?\\s*explicit|not\\s*explicit|none)\\b', cleaned: 'clean' } },
    explicit:      { group: { re: 'explicit|parental', not: 'track|song' }, options: {
      explicit: '^\\s*(yes|explicit)\\b', not_explicit: '^\\s*(no|non-?\\s*explicit|not\\s*explicit|none)\\b', cleaned: 'clean' } },
  },

  lists: {
    artists:      { name: { re: 'primary\\s*artist|^\\s*artist\\s*name', not: 'track|featur|label' }, add: '^\\s*\\+?\\s*add\\s+(another\\s+)?(primary\\s+)?artist' },
    writers:      { name: { re: 'composer|songwriter|writer', not: 'publisher|ipi|share|percent|%' }, add: '^\\s*\\+?\\s*add\\s+(another\\s+)?(composer|songwriter|writer)' },
    contributors: { name: { re: 'contributor\\s*name|credit\\s*name|^\\s*name\\b', not: 'artist|composer|writer|track|release' },
                    title: { re: 'contributor\\s*(title|role)|credit\\s*(title|role)|^\\s*title\\b|^\\s*role\\b' },
                    add: '^\\s*\\+?\\s*add\\s+(another\\s+)?(contributor|credit|producer)' },
  },
}
module.exports = { ROUTENOTE_PROFILE }