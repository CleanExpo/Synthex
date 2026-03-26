/**
 * Author Block — SYN-475
 *
 * Renders an author credential card with photo, credential chip,
 * years experience, bio, and GBP link.
 *
 * Also injects a Person JSON-LD schema tag for E-E-A-T signals.
 */

interface AuthorBlockProps {
  name: string;
  credential: string;
  experienceYears: number;
  gbpLink?: string;
  photoUrl?: string;
  bio?: string;
}

export function AuthorBlock({
  name,
  credential,
  experienceYears,
  gbpLink,
  photoUrl,
  bio,
}: AuthorBlockProps) {
  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description: `${credential}${experienceYears > 0 ? `, ${experienceYears} years experience` : ''}`,
    ...(gbpLink ? { url: gbpLink } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4 my-6 dark:bg-gray-800/50">
        {photoUrl && (
          <img
            src={photoUrl}
            alt={name}
            className="h-14 w-14 rounded-full object-cover flex-shrink-0"
          />
        )}
        <div className="min-w-0">
          <strong className="block text-sm font-semibold text-white/80">
            {name}
          </strong>
          <span className="inline-block mt-0.5 text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">
            {credential}
          </span>
          {experienceYears > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              {experienceYears} yrs exp
            </span>
          )}
          {bio && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              {bio}
            </p>
          )}
          {gbpLink && (
            <a
              href={gbpLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs text-orange-500 hover:underline"
            >
              View on Google
            </a>
          )}
        </div>
      </div>
    </>
  );
}
