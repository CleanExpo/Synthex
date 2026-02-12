/**
 * Schema Generator Config
 * Schema types and field definitions
 */

import {
  Building,
  Package,
  FileText,
  HelpCircle,
  ListOrdered,
  Calendar,
  Video,
  Star,
} from '@/components/icons';
import type { SchemaTypeOption, SchemaField } from './types';

export const SCHEMA_TYPES: SchemaTypeOption[] = [
  { value: 'Organization', label: 'Organization', icon: Building, description: 'Company or brand info' },
  { value: 'LocalBusiness', label: 'Local Business', icon: Building, description: 'Physical business location' },
  { value: 'Product', label: 'Product', icon: Package, description: 'Product listings with price' },
  { value: 'Article', label: 'Article', icon: FileText, description: 'News or blog articles' },
  { value: 'BlogPosting', label: 'Blog Post', icon: FileText, description: 'Blog content' },
  { value: 'FAQ', label: 'FAQ', icon: HelpCircle, description: 'Frequently asked questions' },
  { value: 'HowTo', label: 'How-To Guide', icon: ListOrdered, description: 'Step-by-step instructions' },
  { value: 'Event', label: 'Event', icon: Calendar, description: 'Events and happenings' },
  { value: 'VideoObject', label: 'Video', icon: Video, description: 'Video content' },
  { value: 'Review', label: 'Review', icon: Star, description: 'Product or service reviews' },
];

export const SCHEMA_FIELDS: Record<string, SchemaField[]> = {
  Organization: [
    { name: 'name', label: 'Organization Name', type: 'text', required: true },
    { name: 'url', label: 'Website URL', type: 'url', required: true },
    { name: 'logo', label: 'Logo URL', type: 'url' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'email', label: 'Contact Email', type: 'text' },
    { name: 'phone', label: 'Contact Phone', type: 'text' },
  ],
  Product: [
    { name: 'name', label: 'Product Name', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'image', label: 'Image URL', type: 'url' },
    { name: 'sku', label: 'SKU', type: 'text' },
    { name: 'brand', label: 'Brand', type: 'text' },
    { name: 'price', label: 'Price', type: 'number', required: true },
    { name: 'currency', label: 'Currency', type: 'text', placeholder: 'USD' },
  ],
  Article: [
    { name: 'title', label: 'Article Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'image', label: 'Featured Image URL', type: 'url' },
    { name: 'author', label: 'Author Name', type: 'text', required: true },
    { name: 'publishedDate', label: 'Published Date', type: 'text', placeholder: 'YYYY-MM-DD' },
    { name: 'publisher', label: 'Publisher Name', type: 'text' },
  ],
  FAQ: [{ name: 'questions', label: 'Questions & Answers', type: 'array' }],
};

export function getFieldsForType(schemaType: string): SchemaField[] {
  return SCHEMA_FIELDS[schemaType] || SCHEMA_FIELDS.Organization;
}
