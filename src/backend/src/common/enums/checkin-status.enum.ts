/**
 * Shared check-in status enum used by both tickets and VIP guests.
 * Extracted to avoid circular dependencies between booking and concert modules.
 */
export enum CheckinStatus {
  NOT_CHECKED_IN = 'not_checked_in',
  CHECKED_IN = 'checked_in',
}
