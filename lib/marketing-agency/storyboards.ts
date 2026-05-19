import type { CampaignStoryboard } from './types';

export const restoreAssistLaunchStoryboards: CampaignStoryboard[] = [
  {
    id: 'linkedin-authority',
    title: 'LinkedIn Authority Explainer',
    channel: 'linkedin',
    targetPersona: 'Restoration Company Owner',
    strategy:
      'Open with operational risk, show RestoreAssist as a controlled reporting workflow, and finish with a low-friction report trial.',
    primaryFormat: '16:9',
    audioDirection:
      'Confident senior operator voice, measured pace, no hype, light documentary bed.',
    callToAction: 'Start with 3 reports.',
    rankingRationale: [
      'Uses an expert, operator-style explanation for LinkedIn credibility.',
      'Front-loads job-reporting risk before the product appears.',
      'Keeps captions meaningful for muted feed viewing.',
    ],
    testHypothesis:
      'Best suited to warm LinkedIn audiences who need a fuller product context before clicking.',
    durationSec: 60,
    scenes: [
      {
        index: 1,
        startSec: 0,
        endSec: 7,
        onScreenText: 'A restoration report needs to hold the job together.',
        voiceover: 'A restoration report needs to hold the job together.',
        visualNote: 'Field report fragments on navy background.',
      },
      {
        index: 2,
        startSec: 7,
        endSec: 17,
        onScreenText: 'Photos. Readings. Scope. Estimate.',
        voiceover:
          'Photos, readings, scope notes, and cost lines all need to point back to verified site data.',
        visualNote: 'Inspection photos and notes align into one record.',
      },
      {
        index: 3,
        startSec: 17,
        endSec: 30,
        onScreenText: 'Client-first strategy: reduce confusion before selling software.',
        voiceover:
          'The first message is not software. It is the client problem: inconsistent reporting creates avoidable back-and-forth.',
        visualNote: 'Split screen of field team, office admin, and assessor review.',
      },
      {
        index: 4,
        startSec: 30,
        endSec: 45,
        onScreenText: 'RestoreAssist connects inspection, scoping, estimating, and reporting.',
        voiceover:
          'RestoreAssist helps restoration teams keep the job record connected from inspection through export.',
        visualNote: 'Workflow path moves from capture to scope to PDF and Excel export.',
      },
      {
        index: 5,
        startSec: 45,
        endSec: 60,
        onScreenText: 'Start with 3 reports.',
        voiceover:
          'Use the next three reports to test whether the workflow fits your team before scaling it.',
        visualNote: 'Simple CTA with RestoreAssist.app and report export proof placeholder.',
      },
    ],
  },
  {
    id: 'linkedin-owner-thumbstop-15',
    title: 'LinkedIn Owner Thumbstop 15',
    channel: 'linkedin',
    targetPersona: 'Restoration Company Owner',
    strategy:
      'Condense the owner pain into a 15-second mobile-first feed ad that tests fast recognition against the longer authority explainer.',
    primaryFormat: '9:16',
    audioDirection:
      'Muted-first captions, fast confident voiceover, one sharp transition every three seconds.',
    callToAction: 'Start with 3 reports.',
    rankingRationale: [
      'Matches LinkedIn guidance that many successful video ads cluster around 15 seconds.',
      'Uses vertical mobile format and quick cuts to improve feed stopping power.',
      'Tests one message only: scattered job data becomes a connected report workflow.',
    ],
    testHypothesis:
      'Should beat the 60-second authority cut on view completion and early CTR for cold LinkedIn traffic.',
    durationSec: 15,
    scenes: [
      {
        index: 1,
        startSec: 0,
        endSec: 3,
        onScreenText: 'Your job data is already there.',
        voiceover: 'Your job data is already there.',
        visualNote: 'Hard cut between site photo, moisture reading, and handwritten note.',
      },
      {
        index: 2,
        startSec: 3,
        endSec: 7,
        onScreenText: 'The report is where it falls apart.',
        voiceover: 'The report is where it falls apart.',
        visualNote: 'Documents drift apart, then snap into a single report timeline.',
      },
      {
        index: 3,
        startSec: 7,
        endSec: 12,
        onScreenText: 'RestoreAssist keeps inspection, scope, estimate, and export connected.',
        voiceover:
          'RestoreAssist keeps inspection, scope, estimate, and export connected.',
        visualNote: 'Four-step vertical workflow with report export proof placeholder.',
      },
      {
        index: 4,
        startSec: 12,
        endSec: 15,
        onScreenText: 'Start with 3 reports.',
        voiceover: 'Start with three reports.',
        visualNote: 'RestoreAssist.app CTA, no paid publish until approval.',
      },
    ],
  },
  {
    id: 'linkedin-assessor-proof',
    title: 'LinkedIn Assessor Proof Cut',
    channel: 'linkedin',
    targetPersona: 'Insurance Adjuster / Assessor',
    strategy:
      'Lead with review consistency and evidence traceability, then invite assessors to review a sample report.',
    primaryFormat: '1:1',
    audioDirection:
      'Calm professional narration, minimal music, captions strong enough to work muted.',
    callToAction: 'Review a sample report.',
    rankingRationale: [
      'Uses square format for LinkedIn feed scanability.',
      'Shows credentials and evidence structure rather than broad claims.',
      'Frames the assessor as the hero of a clearer review process.',
    ],
    testHypothesis:
      'Should produce higher qualified engagement from assessor and insurance audiences than owner-focused copy.',
    durationSec: 30,
    scenes: [
      {
        index: 1,
        startSec: 0,
        endSec: 6,
        onScreenText: 'Inconsistent restoration reports slow review.',
        voiceover: 'Inconsistent restoration reports slow review.',
        visualNote: 'Stack of mismatched report pages becomes one clean structure.',
      },
      {
        index: 2,
        startSec: 6,
        endSec: 14,
        onScreenText: 'Evidence should travel with the scope.',
        voiceover:
          'Photos, readings, notes, and estimate lines should stay traceable inside the job record.',
        visualNote: 'Evidence pins attach to scope items.',
      },
      {
        index: 3,
        startSec: 14,
        endSec: 23,
        onScreenText: 'Client-first strategy: make review easier before asking for trust.',
        voiceover:
          'For assessors, the campaign sells clarity first. RestoreAssist is introduced only after the review problem is clear.',
        visualNote: 'Assessor checklist clears one item at a time.',
      },
      {
        index: 4,
        startSec: 23,
        endSec: 30,
        onScreenText: 'Review a sample report.',
        voiceover: 'Review a sample RestoreAssist report and decide if the format helps.',
        visualNote: 'Sample report CTA with blocked real-asset placeholder.',
      },
    ],
  },
  {
    id: 'facebook-field-workflow',
    title: 'Facebook Field Workflow Cut',
    channel: 'facebook',
    targetPersona: 'Field Technician / Supervisor',
    strategy:
      'Use a direct-response pain hook, show the field-to-office handoff, and invite a next-job workflow test.',
    primaryFormat: '9:16',
    audioDirection:
      'Fast practical voice, light percussion bed, designed for captions and quick mobile scanning.',
    callToAction: 'Try the workflow on the next job.',
    rankingRationale: [
      'Opens with a recognizable field-to-office pain inside the first three seconds.',
      'Uses vertical mobile format for Reels and feed placement coverage.',
      'Shows transformation from scattered evidence to a structured job record.',
    ],
    testHypothesis:
      'Should be the strongest Facebook cold-audience creative because the opening problem is immediately visual.',
    durationSec: 30,
    scenes: [
      {
        index: 1,
        startSec: 0,
        endSec: 4,
        onScreenText: 'Site notes should not become office rework.',
        voiceover: 'Site notes should not become office rework.',
        visualNote: 'Phone capture, damp wall photo, and handwritten notes collide.',
      },
      {
        index: 2,
        startSec: 4,
        endSec: 10,
        onScreenText: 'Capture once. Keep the report tied to evidence.',
        voiceover: 'Capture the job once, then keep the report tied to the evidence.',
        visualNote: 'Photo, moisture reading, room note, and scope line lock together.',
      },
      {
        index: 3,
        startSec: 10,
        endSec: 20,
        onScreenText: 'Client-first strategy: show relief before product features.',
        voiceover:
          'The ad starts with the supervisor problem. Only then does it show how RestoreAssist structures the workflow.',
        visualNote: 'Before and after workflow board, no fake performance claim.',
      },
      {
        index: 4,
        startSec: 20,
        endSec: 30,
        onScreenText: 'Try the workflow on the next job.',
        voiceover: 'Try RestoreAssist on the next job and export the report your team can review.',
        visualNote: 'Mobile CTA with report export and blocked publish gate marker.',
      },
    ],
  },
  {
    id: 'facebook-retargeting-15',
    title: 'Facebook Retargeting 15',
    channel: 'facebook',
    targetPersona: 'Restoration Company Owner',
    strategy:
      'Retarget warm visitors with one remembered pain, one workflow promise, and one low-risk trial CTA.',
    primaryFormat: '9:16',
    audioDirection:
      'Short muted-first cut with strong captions, restrained hit points, no invented testimonial.',
    callToAction: 'Start with 3 reports.',
    rankingRationale: [
      'Uses a 15-second retargeting format with one remembered pain and one CTA.',
      'Avoids feature overload and keeps the first frame text self-contained.',
      'Maintains 9:16 vertical creative for mobile-first placement testing.',
    ],
    testHypothesis:
      'Should work best for warm Facebook audiences who have already seen RestoreAssist but have not tried a report.',
    durationSec: 15,
    scenes: [
      {
        index: 1,
        startSec: 0,
        endSec: 3,
        onScreenText: 'Still building reports from scattered job data?',
        voiceover: 'Still building reports from scattered job data?',
        visualNote: 'Rapid phone-to-desktop handoff.',
      },
      {
        index: 2,
        startSec: 3,
        endSec: 9,
        onScreenText: 'Inspection. Scope. Estimate. Export.',
        voiceover: 'RestoreAssist keeps inspection, scope, estimate, and export in one workflow.',
        visualNote: 'Four-step vertical stack animates upward.',
      },
      {
        index: 3,
        startSec: 9,
        endSec: 15,
        onScreenText: 'Start with 3 reports.',
        voiceover: 'Start with three reports and see if it fits your next job.',
        visualNote: 'Bold CTA, RestoreAssist.app, licence and publish status remain blocked.',
      },
    ],
  },
];
