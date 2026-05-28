export type { Database, Json } from './generated.ts';
import type { Database } from './generated.ts';

export type Resource = Database['public']['Tables']['resources']['Row'];
export type ResourceInsert = Database['public']['Tables']['resources']['Insert'];
export type ResourceStatus = Resource['status'];

export type Settings = Database['public']['Tables']['settings']['Row'];
export type SettingsInsert = Database['public']['Tables']['settings']['Insert'];

export const DEFAULT_RESOURCES_PER_NEWSLETTER = 3;
export const DEFAULT_TONE_PROMPT = '';
