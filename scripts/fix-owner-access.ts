/**
 * One-time script: Set onboardingComplete = true for the owner account
 * so they can access the dashboard immediately without Stripe setup.
 * Run: npx ts-node scripts/fix-owner-access.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'phill.mcgurk@gmail.com';
  
  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, onboardingComplete: true, emailVerified: true, authProvider: true }
  });

  if (!user) {
    console.log(`❌ User not found: ${email}`);
    console.log('  → Make sure you have signed up first at /signup or /login with Google');
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.name} (${user.email})`);
  console.log(`   authProvider: ${user.authProvider}`);
  console.log(`   emailVerified: ${user.emailVerified}`);
  console.log(`   onboardingComplete: ${user.onboardingComplete}`);

  // Update the user
  const updated = await prisma.user.update({
    where: { email },
    data: {
      onboardingComplete: true,
      apiKeyConfigured: true,   // Skip API key requirement for owner
      emailVerified: new Date(),  // Mark email as verified
    }
  });

  console.log('');
  console.log('🎉 Account updated successfully!');
  console.log(`   onboardingComplete: ${updated.onboardingComplete}`);
  console.log(`   apiKeyConfigured:   ${updated.apiKeyConfigured}`);
  console.log(`   emailVerified:      ${updated.emailVerified}`);
  console.log('');
  console.log('→ Sign out and sign back in to get a new JWT with the updated flags.');
  console.log(`→ Use Google Sign-In if authProvider is 'google', otherwise use email/password.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
