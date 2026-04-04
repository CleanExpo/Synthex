/**
 * Seed System Templates
 * Migrates hardcoded templates from lib/content-templates.ts to database
 *
 * Run: npm run seed:templates
 */

import { PrismaClient } from '@prisma/client';
import { contentTemplates } from '../lib/content-templates';

const prisma = new PrismaClient();

async function seedTemplates() {
  console.log('Seeding system templates...');

  let created = 0;
  let updated = 0;

  for (const template of contentTemplates) {
    const templateId = `system-${template.id}`;

    const existing = await prisma.promptTemplate.findUnique({
      where: { id: templateId },
    });

    if (existing) {
      // Update existing system template
      await prisma.promptTemplate.update({
        where: { id: templateId },
        data: {
          name: template.name,
          description: template.description,
          icon: template.icon,
          category: template.category,
          platforms: template.platforms,
          structure: template.structure,
          variables: template.variables || [],
          tips: template.tips || [],
          usageCount: template.popularity,
        },
      });
      updated++;
      console.log(`  ↻ Updated: ${template.name}`);
    } else {
      // Create new system template
      await prisma.promptTemplate.create({
        data: {
          id: templateId,
          userId: null, // System template - no owner
          organizationId: null,
          name: template.name,
          description: template.description,
          icon: template.icon,
          category: template.category,
          platforms: template.platforms,
          structure: template.structure,
          variables: template.variables || [],
          tips: template.tips || [],
          isPublic: true,
          isSystem: true,
          usageCount: template.popularity,
        },
      });
      created++;
      console.log(`  ✓ Created: ${template.name}`);
    }
  }

  console.log('');
  console.log(`Seeding complete: ${created} created, ${updated} updated`);
  console.log(`Total system templates: ${contentTemplates.length}`);
}

seedTemplates()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
