/**
 * Industry classifier for the demo URL pipeline.
 *
 * Extracted from app/api/demo/analyze/route.ts (SYN-853) so tests can import
 * it without pulling the rate-limiter / Redis / auth chain into Jest.
 *
 * Order matters: more-specific categories must be checked before generic
 * ones because the cascade returns on first match.
 */

export function detectIndustry(text: string): string {
  const t = text.toLowerCase();

  // 1. Most specific first: education / professional training / certification.
  //    Catches IICRC CEC, CPD, RTO, online courses, certifications, academies.
  if (
    /\b(iicrc|rto|cec|cpd)\b|\b(professional|online|short)\s+(course|training|certification)|\bcertification\s+(course|program|training)|\b(academy|institute|university|college|training\s+provider)\b|\b(elearning|e-learning|lms|learning\s+management)\b/.test(
      t
    )
  )
    return 'education & training';

  // 2. B2B SaaS / professional-services software. Catches "B2B", explicit
  //    "SaaS", platform/api/dashboard language paired with subscription cues.
  if (
    /\bb2b\b|\bsaas\b|\bsoftware[-\s]as[-\s]a[-\s]service\b|\bapi[-\s]platform\b|\b(workflow|operations|claims|case|job|project)\s+(software|platform|management\s+software)\b|\b(restoration|construction|trades|insurance)\s+(software|platform|saas)\b/.test(
      t
    )
  )
    return 'B2B SaaS';

  // 3. Cleaning & restoration — moved up so it wins over real-estate's
  //    "property" trigger when both appear (restoration sites talk about
  //    "property damage" frequently).
  if (
    /\b(restoration|water\s+damage|fire\s+damage|mould\s+remediation|biohaz|trauma\s+clean)|\b(carpet|upholstery|tile)\s+cleaning\b|\bcleaning\s+(service|company|business)\b|\bremediation\b/.test(
      t
    )
  )
    return 'cleaning & restoration';

  // 4. Hospitality
  if (/\b(cafe|coffee|espresso|barista|roastery|roaster)\b/.test(t))
    return 'cafe';
  if (/\b(restaurant|bistro|eatery|cuisine|fine\s+dining)\b/.test(t))
    return 'restaurant';

  // 5. Beauty / salon — TIGHTENED. Dropped "colour" (matched every AU page)
  //    and "wax" (matched restoration "wax coatings"). Requires explicit
  //    salon/beauty signal.
  if (
    /\b(hair\s+salon|beauty\s+salon|nail\s+salon|day\s+spa|hairdresser|barbershop|barber\s+shop|cosmetic|makeup\s+artist|aesthetician|waxing\s+(studio|salon))\b/.test(
      t
    )
  )
    return 'beauty salon';

  // 6. Fitness
  if (
    /\b(gym|fitness\s+(centre|center|studio)|personal\s+train|yoga\s+(studio|class)|pilates\s+(studio|class)|bootcamp|crossfit)\b/.test(
      t
    )
  )
    return 'gym & fitness';

  // 7. Trades / construction (services, not software — that's caught above)
  if (
    /\b(plumber|plumbing|electrician|electrical|tradesman|tradie|builder|construction\s+(company|services)|renovation|carpenter|roofer|landscape)\b/.test(
      t
    )
  )
    return 'trades';

  // 8. Dental
  if (/\b(dental|dentist|orthodontic|orthodontist|teeth\s+whitening)\b/.test(t))
    return 'dental';

  // 9. Health & wellness
  if (
    /\b(physiotherapy|physio|chiropractic|chiropractor|remedial\s+massage|naturopath|osteopath)\b/.test(
      t
    )
  )
    return 'health & wellness';

  // 10. Real estate — TIGHTENED. Bare "propert" matched any site mentioning
  //     property. Now requires real-estate-specific context.
  if (
    /\b(real\s+estate|realtor|property\s+(for\s+sale|listing|management|investment|valuation)|mortgage\s+broker|rental\s+property|properties\s+for\s+(sale|rent))\b/.test(
      t
    )
  )
    return 'real estate';

  // 11. Accounting & finance
  if (
    /\b(accountant|accounting\s+(firm|services)|bookkeep|tax\s+(agent|return)|financial\s+adviser|finance\s+broker|wealth\s+management)\b/.test(
      t
    )
  )
    return 'accounting & finance';

  // 12. Legal
  if (
    /\b(law\s+firm|lawyer|solicitor|barrister|attorney|legal\s+services)\b/.test(
      t
    )
  )
    return 'legal';

  // 13. Retail
  if (
    /\b(retail\s+store|boutique|fashion\s+(store|brand|label)|online\s+shop|ecommerce|e-commerce)\b/.test(
      t
    )
  )
    return 'retail';

  // 14. Generic technology — only if not caught by B2B SaaS above
  if (
    /\b(software\s+(company|developer)|web\s+development|app\s+development|digital\s+agency|tech\s+startup)\b/.test(
      t
    )
  )
    return 'technology';

  return 'local business';
}
