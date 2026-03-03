const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'phill.mcgurk@gmail.com';

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, onboardingComplete: true, emailVerified: true, authProvider: true, apiKeyConfigured: true }
  });

  if (!user) {
    console.log('USER_NOT_FOUND: ' + email);
    console.log('Make sure you have created an account first.');
    return;
  }

  console.log('FOUND USER:', JSON.stringify(user, null, 2));

  const updated = await prisma.user.update({
    where: { email },
    data: {
      onboardingComplete: true,
      apiKeyConfigured: true,
      emailVerified: user.emailVerified || new Date(),
    }
  });

  console.log('');
  console.log('SUCCESS!');
  console.log('  onboardingComplete: ' + updated.onboardingComplete);
  console.log('  apiKeyConfigured:   ' + updated.apiKeyConfigured);
  console.log('  emailVerified:      ' + updated.emailVerified);
  console.log('');
  console.log('Now sign out and sign back in to refresh your JWT token.');
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
