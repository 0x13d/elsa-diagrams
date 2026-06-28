/**
 * Optional callback to override the sanitized display label for an activity.
 * Return undefined to fall back to the default sanitized label.
 */
export type LabelResolver = (activityType: string, activityId: string) => string | undefined;
